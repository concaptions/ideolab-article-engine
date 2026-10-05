// Create the post through the Blog Posts API.
//
// Two things that were learned the hard way and must not be undone:
//   category is the category NAME, not an id. An unknown name silently creates
//   a new category, so it is checked against the site list first.
//   the cover only attaches on creation. A PATCH can replace a cover that is
//   already there, but it cannot add one to a post that has none, it returns
//   200 and stores nothing. So the cover goes in this same call or never.
import { api, log } from './lib.mjs'

export async function publishPost(site, { title, slug, excerpt, content, category, coverUrl, coverAlt, status = 'published' }) {
  const cat = category || site.defaultCategory
  if (!site.categories.includes(cat)) {
    throw new Error('Category "' + cat + '" is not one of ' + site.categories.join(', ') + '. An unknown name would create a new category.')
  }
  if (!coverUrl) throw new Error('No cover url. It cannot be added after the post exists.')

  const body = { title, slug, excerpt, content, status, category: cat, thumbnail: { url: coverUrl, alt: coverAlt || title } }
  const out = await api(site, '/blog/posts', { method: 'POST', body: JSON.stringify(body) })

  const back = await api(site, '/blog/posts/' + out.id)
  const post = back.post || back
  if (!post.thumbnail) throw new Error('Post created but the cover did not attach, id ' + out.id)
  log('publish', status + '  id ' + out.id + '  cover stored')
  return { id: out.id, slug: post.slug, status: post.status, thumbnail: post.thumbnail.url }
}
