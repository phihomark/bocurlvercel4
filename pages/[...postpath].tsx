import React from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { GraphQLClient, gql } from 'graphql-request';

interface PostAuthor {
	node?: {
		name?: string;
	};
}

interface FeaturedImage {
	node?: {
		sourceUrl?: string;
		altText?: string;
	};
}

interface PostData {
	id: string;
	excerpt?: string;
	title?: string;
	link?: string;
	dateGmt?: string;
	modifiedGmt?: string;
	content?: string;
	author?: PostAuthor;
	featuredImage?: FeaturedImage;
}

interface PostsWhereResponse {
	posts?: {
		nodes?: PostData[];
	} | null;
}

interface NodeByUriQueryResponse {
	nodeByUri?: PostData | null;
}

interface PostQueryResponse {
	post?: PostData | null;
}

// 1. WP_Query based GraphQL query (Resilient against URI resolver bugs)
const GET_POST_BY_WHERE_SLUG = gql`
	query GetPostBySlug($slug: String!) {
		posts(where: { name: $slug }) {
			nodes {
				id
				excerpt
				title
				link
				dateGmt
				modifiedGmt
				content
				author {
					node {
						name
					}
				}
				featuredImage {
					node {
						sourceUrl
						altText
					}
				}
			}
		}
	}
`;

// 2. Standard nodeByUri for WPGraphQL 2.x
const GET_NODE_BY_URI = gql`
	query GetNodeByUri($uri: String!) {
		nodeByUri(uri: $uri) {
			__typename
			... on Post {
				id
				excerpt
				title
				link
				dateGmt
				modifiedGmt
				content
				author {
					node {
						name
					}
				}
				featuredImage {
					node {
						sourceUrl
						altText
					}
				}
			}
			... on Page {
				id
				title
				content
				dateGmt
				modifiedGmt
				link
				featuredImage {
					node {
						sourceUrl
						altText
					}
				}
			}
		}
	}
`;

// 3. Fallback Post query by SLUG or URI
const GET_POST_BY_SLUG_OR_URI = gql`
	query GetPost($id: ID!, $idType: PostIdType!) {
		post(id: $id, idType: $idType) {
			id
			excerpt
			title
			link
			dateGmt
			modifiedGmt
			content
			author {
				node {
					name
				}
			}
			featuredImage {
				node {
					sourceUrl
					altText
				}
			}
		}
	}
`;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
	const endpoint = (process.env.GRAPHQL_ENDPOINT as string) || '';
	const referringURL = ctx.req.headers?.referer || null;
	const pathArr = (ctx.query.postpath as Array<string>) || [];
	const path = pathArr.join('/');
	const slug = pathArr.length > 0 ? pathArr[pathArr.length - 1] : path;
	const fbclid = ctx.query.fbclid;

	// Redirect if Facebook is the referer or request contains fbclid
	const userAgent = ctx.req.headers['user-agent'] || '';
	const isFacebookBot =
		userAgent.includes('facebookexternalhit') ||
		userAgent.includes('Facebot');

	if (!isFacebookBot && (referringURL?.includes('facebook.com') || fbclid)) {
		const targetDomain = endpoint
			? endpoint.replace(/(\/graphql\/?)/, '/')
			: '/';
		return {
			redirect: {
				permanent: false,
				destination: `${targetDomain}${encodeURI(path)}`,
			},
		};
	}

	if (!endpoint) {
		console.warn('GRAPHQL_ENDPOINT environment variable is not defined.');
		return {
			notFound: true,
		};
	}

	let post: PostData | null = null;
	const graphQLClient = new GraphQLClient(endpoint);
	const cleanUri = `/${path}/`;

	// Strategy 1: GraphQL posts(where: { name: $slug }) - WP_Query based
	if (slug) {
		try {
			const data = await graphQLClient.request<PostsWhereResponse>(
				GET_POST_BY_WHERE_SLUG,
				{ slug }
			);
			if (data?.posts?.nodes && data.posts.nodes.length > 0) {
				post = data.posts.nodes[0];
			}
		} catch (err) {
			console.warn('GraphQL posts(where: { name }) failed:', err instanceof Error ? err.message : err);
		}
	}

	// Strategy 2: GraphQL nodeByUri
	if (!post) {
		try {
			const data = await graphQLClient.request<NodeByUriQueryResponse>(
				GET_NODE_BY_URI,
				{ uri: cleanUri }
			);
			if (data?.nodeByUri) {
				post = data.nodeByUri;
			}
		} catch (err) {
			console.warn('GraphQL nodeByUri query failed:', err instanceof Error ? err.message : err);
		}
	}

	// Strategy 3: GraphQL post(id: slug, idType: SLUG)
	if (!post && slug) {
		try {
			const data = await graphQLClient.request<PostQueryResponse>(
				GET_POST_BY_SLUG_OR_URI,
				{ id: slug, idType: 'SLUG' }
			);
			if (data?.post) {
				post = data.post;
			}
		} catch (err) {
			console.warn('GraphQL post by SLUG failed:', err instanceof Error ? err.message : err);
		}
	}

	// Strategy 4: WordPress Core REST API Fallback
	// When WPGraphQL plugin returns 500 internal server errors, fallback to WP REST API directly!
	if (!post && slug) {
		try {
			const wpRestBase = endpoint.replace(/(\/graphql\/?)/, '/wp-json/wp/v2/posts');
			const restRes = await fetch(`${wpRestBase}?slug=${encodeURIComponent(slug)}&_embed=true`);
			if (restRes.ok) {
				const wpPosts = await restRes.json();
				if (Array.isArray(wpPosts) && wpPosts.length > 0) {
					const wpPost = wpPosts[0];
					post = {
						id: String(wpPost.id),
						title: wpPost.title?.rendered || '',
						excerpt: wpPost.excerpt?.rendered || '',
						content: wpPost.content?.rendered || '',
						link: wpPost.link || '',
						dateGmt: wpPost.date_gmt || wpPost.date || '',
						modifiedGmt: wpPost.modified_gmt || wpPost.modified || '',
						author: {
							node: {
								name: wpPost._embedded?.author?.[0]?.name || '',
							},
						},
						featuredImage: {
							node: {
								sourceUrl: wpPost._embedded?.['wp:featuredmedia']?.[0]?.source_url || '',
								altText: wpPost._embedded?.['wp:featuredmedia']?.[0]?.alt_text || '',
							},
						},
					};
				}
			}
		} catch (err) {
			console.warn('WordPress REST API fallback failed:', err instanceof Error ? err.message : err);
		}
	}

	// Strategy 5: WordPress Core REST API Fallback for Pages
	if (!post && slug) {
		try {
			const wpPagesBase = endpoint.replace(/(\/graphql\/?)/, '/wp-json/wp/v2/pages');
			const restRes = await fetch(`${wpPagesBase}?slug=${encodeURIComponent(slug)}&_embed=true`);
			if (restRes.ok) {
				const wpPages = await restRes.json();
				if (Array.isArray(wpPages) && wpPages.length > 0) {
					const wpPage = wpPages[0];
					post = {
						id: String(wpPage.id),
						title: wpPage.title?.rendered || '',
						excerpt: wpPage.excerpt?.rendered || '',
						content: wpPage.content?.rendered || '',
						link: wpPage.link || '',
						dateGmt: wpPage.date_gmt || wpPage.date || '',
						modifiedGmt: wpPage.modified_gmt || wpPage.modified || '',
						author: {
							node: {
								name: wpPage._embedded?.author?.[0]?.name || '',
							},
						},
						featuredImage: {
							node: {
								sourceUrl: wpPage._embedded?.['wp:featuredmedia']?.[0]?.source_url || '',
								altText: wpPage._embedded?.['wp:featuredmedia']?.[0]?.alt_text || '',
							},
						},
					};
				}
			}
		} catch (err) {
			console.warn('WordPress REST API pages fallback failed:', err instanceof Error ? err.message : err);
		}
	}

	if (!post) {
		return {
			notFound: true,
		};
	}

	return {
		props: {
			path,
			post,
			host: ctx.req.headers.host || '',
		},
	};
};

interface PostProps {
	post: PostData;
	host: string;
	path: string;
}

const Post: React.FC<PostProps> = (props) => {
	const { post, host, path } = props;

	// Remove HTML tags from excerpt for meta tags
	const removeTags = (str?: string) => {
		if (!str) return '';
		return str.replace(/(<([^>]+)>)/gi, '').replace(/\[[^\]]*\]/, '').trim();
	};

	const featuredImageUrl = post?.featuredImage?.node?.sourceUrl || '';
	const featuredImageAlt = post?.featuredImage?.node?.altText || post?.title || '';
	const siteName = host ? host.split('.')[0] : '';

	return (
		<>
			<Head>
				<meta property="og:title" content={post?.title || ''} />
				<link rel="canonical" href={`https://${host}/${path}`} />
				<meta property="og:description" content={removeTags(post?.excerpt)} />
				<meta property="og:url" content={`https://${host}/${path}`} />
				<meta property="og:type" content="article" />
				<meta property="og:locale" content="en_US" />
				<meta property="og:site_name" content={siteName} />
				{post?.dateGmt && <meta property="article:published_time" content={post.dateGmt} />}
				{post?.modifiedGmt && <meta property="article:modified_time" content={post.modifiedGmt} />}
				{featuredImageUrl && <meta property="og:image" content={featuredImageUrl} />}
				{featuredImageUrl && (
					<meta property="og:image:alt" content={featuredImageAlt} />
				)}
				<title>{post?.title || 'Article'}</title>
			</Head>
			<div className="post-container">
				<h1>{post?.title}</h1>
				{featuredImageUrl && (
					<img src={featuredImageUrl} alt={featuredImageAlt} />
				)}
				{post?.content && (
					<article dangerouslySetInnerHTML={{ __html: post.content }} />
				)}
			</div>
		</>
	);
};

export default Post;
