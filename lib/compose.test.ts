import { describe, expect, it } from 'vitest'
import { blocker, candidateName, MIN_REVIEW, toPost, type Draft } from './compose'

const draft = (over: Partial<Draft> = {}): Draft =>
  ({ text: '', slug: null, newName: '', rating: 0, photo: null, ...over })

describe('candidateName', () => {
  it('takes the first clause', () => {
    expect(candidateName('Registon qahvaxonasi, ertalab non issiq böladi'))
      .toBe('Registon qahvaxonasi')
    expect(candidateName('Non dökoni. Arzon.')).toBe('Non dökoni')
  })

  it('stops at six words rather than swallowing the review', () => {
    // A proposal that ate the whole sentence reads as broken, and a broken
    // proposal is what gets the box abandoned.
    const long = 'Bir ikki uç tört beş olti yetti sakkiz'
    expect(candidateName(long)).toBe('Bir ikki uç tört beş olti')
  })

  it('does not end on a joining word', () => {
    expect(candidateName('Çorsu bozori va')).toBe('Çorsu bozori')
    expect(candidateName('Kafe haqida')).toBe('Kafe')
  })

  it('survives text with nothing to take', () => {
    expect(candidateName('')).toBe('')
    expect(candidateName('   ')).toBe('')
    expect(candidateName('...')).toBe('')
  })

  it('caps the length the submissions table caps', () => {
    expect(candidateName('x'.repeat(400)).length).toBeLessThanOrEqual(120)
  })
})

describe('toPost — an existing place', () => {
  const body = 'Meva arzon, ertalab tanlov köp böladi.'

  it('becomes a review', () => {
    expect(toPost(draft({ slug: 'chorsu-bozori', rating: 5, text: body })))
      .toEqual({ kind: 'review', slug: 'chorsu-bozori', rating: 5, body })
  })

  it('needs the text floor the database enforces', () => {
    expect(toPost(draft({ slug: 'chorsu-bozori', rating: 5, text: 'Zör!' }))).toBeNull()
    expect(toPost(draft({ slug: 'chorsu-bozori', rating: 5, text: 'x'.repeat(MIN_REVIEW) })))
      .not.toBeNull()
  })

  it('trims before measuring, so spaces do not buy a review', () => {
    expect(toPost(draft({ slug: 'x', rating: 5, text: ' '.repeat(40) }))).toBeNull()
  })
})

describe('toPost — a new place', () => {
  it('becomes a suggestion with its first rating', () => {
    expect(toPost(draft({ newName: 'Registon qahvaxonasi', rating: 4, text: 'Non issiq.' })))
      .toEqual({
        kind: 'place',
        name: 'Registon qahvaxonasi',
        rating: 4,
        comment: 'Non issiq.',
      })
  })

  it('does not need any text — a name, a star and a photo is enough', () => {
    // Unlike a review. A shop nobody has listed is worth having on the
    // strength of existing.
    const post = toPost(draft({ newName: 'Non dökoni', rating: 5, photo: 'data:image/jpeg;base64,x' }))
    expect(post).toEqual({
      kind: 'place',
      name: 'Non dökoni',
      rating: 5,
      photo: 'data:image/jpeg;base64,x',
    })
    expect(post && 'comment' in post).toBe(false)
  })

  it('needs a name', () => {
    expect(toPost(draft({ newName: 'X', rating: 5 }))).toBeNull()
    expect(toPost(draft({ newName: '', rating: 5, text: 'a'.repeat(30) }))).toBeNull()
  })
})

describe('toPost — the rating', () => {
  it('is required, and bounded', () => {
    const base = { slug: 'chorsu-bozori', text: 'x'.repeat(30) }
    expect(toPost(draft({ ...base, rating: 0 }))).toBeNull()
    expect(toPost(draft({ ...base, rating: 6 }))).toBeNull()
    expect(toPost(draft({ ...base, rating: -1 }))).toBeNull()
    expect(toPost(draft({ ...base, rating: 1 }))).not.toBeNull()
  })

  it('a chosen place wins over a typed name', () => {
    // Tapping a suggestion is an explicit choice; a proposed name is a
    // guess. The choice has to win or tapping would appear not to work.
    const post = toPost(draft({
      slug: 'chorsu-bozori',
      newName: 'Boşqa joy',
      rating: 5,
      text: 'x'.repeat(30),
    }))
    expect(post?.kind).toBe('review')
  })
})

describe('blocker', () => {
  it('says nothing on an untouched box', () => {
    expect(blocker(draft())).toBeNull()
  })

  it('asks for one thing at a time, in the order they are needed', () => {
    expect(blocker(draft({ text: 'Çorsu' }))).toBe('Joyni tanlang')
    expect(blocker(draft({ text: 'Çorsu', newName: 'Çorsu bozori' }))).toBe('Yulduz qöying')
    expect(blocker(draft({ text: 'Zör', slug: 'chorsu-bozori', rating: 5 })))
      .toBe(`Yana ${MIN_REVIEW - 3} ta belgi`)
  })

  it('says nothing once the draft is ready', () => {
    expect(blocker(draft({ slug: 'x', rating: 5, text: 'y'.repeat(30) }))).toBeNull()
    expect(blocker(draft({ newName: 'Non dökoni', rating: 5 }))).toBeNull()
  })

  it('never disagrees with toPost', () => {
    // The two are read by the same button. If one said "ready" while the
    // other returned null, the button would be enabled and do nothing.
    const cases: Draft[] = [
      draft(),
      draft({ text: 'Çorsu' }),
      draft({ text: 'Çorsu', newName: 'Çorsu bozori' }),
      draft({ text: 'Çorsu', newName: 'Çorsu bozori', rating: 3 }),
      draft({ slug: 'x', rating: 5, text: 'short' }),
      draft({ slug: 'x', rating: 5, text: 'z'.repeat(30) }),
      draft({ newName: 'Non dökoni', rating: 5 }),
    ]
    for (const d of cases) {
      const ready = toPost(d) !== null
      const touched = Boolean(d.text.trim() || d.slug)
      // An untouched box is not "ready", it is simply not started, and
      // blocker stays quiet about it rather than nagging.
      if (touched) expect(blocker(d) === null).toBe(ready)
    }
  })
})
