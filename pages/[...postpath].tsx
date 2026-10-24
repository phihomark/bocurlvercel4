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

// Helper function to extract base WordPress REST API URL
const getWpApiBase = (endpointStr: string) => {
	if (!endpointStr) return '';
	const base = endpointStr.replace(/\/graphql\/?$/, '').replace(/\/$/, '');
	return `${base}/wp-json/wp/v2`;
};

// Helper function to extract base WordPress site domain
const getWpSiteDomain = (endpointStr: string) => {
	if (!endpointStr) return '/';
	const base = endpointStr.replace(/\/graphql\/?$/, '').replace(/\/$/, '');
	return `${base}/`;
};

// Helper function for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 3500) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'application/json',
				...(options.headers || {}),
			},
		});
		clearTimeout(timeoutId);
		return response;
	} catch (err) {
		clearTimeout(timeoutId);
		throw err;
	}
};

// GraphQL Queries
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

	// Ignore common bot/scanner paths immediately
	const isScanner =
		path.endsWith('.txt') ||
		path.endsWith('.ico') ||
		path.endsWith('.png') ||
		path.startsWith('.well-known') ||
		path.includes('security') ||
		path.includes('our-team') ||
		path.includes('about/team');

	if (isScanner) {
		return { notFound: true };
	}

	// Redirect if Facebook is the referer or request contains fbclid
	const userAgent = ctx.req.headers['user-agent'] || '';
	const isFacebookBot =
		userAgent.includes('facebookexternalhit') ||
		userAgent.includes('Facebot');

	if (!isFacebookBot && (referringURL?.includes('facebook.com') || fbclid)) {
		const targetDomain = getWpSiteDomain(endpoint);
		return {
			redirect: {
				permanent: false,
				destination: `${targetDomain}${encodeURI(path)}`,
			},
		};
	}

	if (!endpoint) {
		console.warn('GRAPHQL_ENDPOINT environment variable is not defined.');
		return { notFound: true };
	}

	let post: PostData | null = null;
	const wpRestBase = getWpApiBase(endpoint);

	// Strategy 1: Fast WordPress Native REST API for Posts (Primary & Blazing Fast < 500ms)
	if (slug && wpRestBase) {
		try {
			const restRes = await fetchWithTimeout(
				`${wpRestBase}/posts?slug=${encodeURIComponent(slug)}&_embed=true`,
				{},
				3500
			);
			if (restRes.ok) {
				const wpPosts = await restRes.json();
				if (Array.isArray(wpPosts) && wpPosts.length > 0) {
					const wpPost = wpPosts[0];
					let featuredImgUrl =
						wpPost._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
					let featuredImgAlt =
						wpPost._embedded?.['wp:featuredmedia']?.[0]?.alt_text ||
						wpPost.title?.rendered ||
						'';

					// Fallback: extract image from content if no featured image set
					if (!featuredImgUrl && wpPost.content?.rendered) {
						const imgMatch = wpPost.content.rendered.match(
							/<img[^>]+src=["']([^"']+)["']/i
						);
						if (imgMatch && imgMatch[1]) {
							featuredImgUrl = imgMatch[1];
						}
					}

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
								sourceUrl: featuredImgUrl,
								altText: featuredImgAlt,
							},
						},
					};
				}
			}
		} catch (err) {
			console.warn(
				'WordPress REST API posts query skipped/failed:',
				err instanceof Error ? err.message : err
			);
		}
	}

	// Strategy 2: WordPress Native REST API for Pages
	if (!post && slug && wpRestBase) {
		try {
			const restRes = await fetchWithTimeout(
				`${wpRestBase}/pages?slug=${encodeURIComponent(slug)}&_embed=true`,
				{},
				3000
			);
			if (restRes.ok) {
				const wpPages = await restRes.json();
				if (Array.isArray(wpPages) && wpPages.length > 0) {
					const wpPage = wpPages[0];
					let featuredImgUrl =
						wpPage._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
					let featuredImgAlt =
						wpPage._embedded?.['wp:featuredmedia']?.[0]?.alt_text ||
						wpPage.title?.rendered ||
						'';

					if (!featuredImgUrl && wpPage.content?.rendered) {
						const imgMatch = wpPage.content.rendered.match(
							/<img[^>]+src=["']([^"']+)["']/i
						);
						if (imgMatch && imgMatch[1]) {
							featuredImgUrl = imgMatch[1];
						}
					}

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
								sourceUrl: featuredImgUrl,
								altText: featuredImgAlt,
							},
						},
					};
				}
			}
		} catch (err) {
			console.warn(
				'WordPress REST API pages query skipped/failed:',
				err instanceof Error ? err.message : err
			);
		}
	}

	// Strategy 3: GraphQL queries with strict short timeout (2.5s max)
	if (!post) {
		try {
			const graphQLClient = new GraphQLClient(endpoint, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				},
				timeout: 2500, // Strict 2.5s timeout for GraphQL so it never hangs
			});

			if (slug) {
				const data = await graphQLClient.request<PostsWhereResponse>(
					GET_POST_BY_WHERE_SLUG,
					{ slug }
				);
				if (data?.posts?.nodes && data.posts.nodes.length > 0) {
					post = data.posts.nodes[0];
				}
			}

			if (!post) {
				const cleanUri = `/${path}/`;
				const data = await graphQLClient.request<NodeByUriQueryResponse>(
					GET_NODE_BY_URI,
					{ uri: cleanUri }
				);
				if (data?.nodeByUri) {
					post = data.nodeByUri;
				}
			}

			if (!post && slug) {
				const data = await graphQLClient.request<PostQueryResponse>(
					GET_POST_BY_SLUG_OR_URI,
					{ id: slug, idType: 'SLUG' }
				);
				if (data?.post) {
					post = data.post;
				}
			}
		} catch (err) {
			console.warn(
				'GraphQL fallback queries skipped:',
				err instanceof Error ? err.message : err
			);
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
