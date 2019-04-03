import rp from 'request-promise-native'
import nanoid from 'nanoid'
import { Category, Movie } from '../database/schema'
import upload from '../lib/upload'
import logger from '../lib/logger'

async function fetchMovie(item) {
  const url = `http://api.douban.com/v2/movie/subject/${item.doubanId}`
  const res = await rp(url)
  let body
  try {
    body = JSON.parse(res)
  } catch (error) {
    logger.error(error)
  }
  return body
}

export default async function() {
  const movies = await Movie.find({
    $or: [{ summary: { $exists: false } }, { summary: null }, { summary: '' }]
  })

  for (let index = 0; index < movies.length; index++) {
    const movie = movies[index]
    const movieData = await fetchMovie(movie)
    if (!movieData) return

    movie.summary = movieData.summary || ''
    movie.year = movieData.year || null
    movie.countries = movieData.countries || []

    for (let index = 0; index < movieData.genres.length; index++) {
      const item = movieData.genres[index]

      let cat = await Category.findOne({ name: item })
      if (!cat) {
        cat = new Category({
          name: item,
          movies: [movie._id]
        })
        await cat.save()
      } else if (!cat.movies.includes(movie._id)) {
        cat.movies.push(movie._id)
      }

      if (!movie.category.includes(cat._id)) {
        movie.category.push(cat._id)
      }
    }

    for (let index = 0; index < movieData.casts.length; index++) {
      const cast = movieData.casts[index]
      const newCast = {
        name: cast.name,
        avatar: cast.avatars.large
      }

      try {
        const path = `/avatar/${nanoid()}.jpg`
        const res = await upload(cast.avatars.large, path)
        if (res) {
          newCast.avatarKey = path
        } else {
          logger.error('api success but error avatar upload', res)
        }
      } catch (error) {
        logger.error('error upload avatar', error)
      }
      movie.casts.push(newCast)
    }

    await movie.save()
  }
}
