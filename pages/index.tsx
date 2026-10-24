import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Country Music World</title>
        <meta name="description" content="Country Music World" />
        <link rel="icon" href="/favicon (1).ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="hhttps://country.discovermusic.us/">Country.discovermusic.us</a>
        </h1>
      </main>
    </div>
  )
}

export default Home
