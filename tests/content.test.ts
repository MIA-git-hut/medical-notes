import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// The production content tools are plain ESM so they can run without a TypeScript loader.
// @ts-expect-error JavaScript module intentionally has no declaration file.
import { selectReviewedCards, validateStudyContent } from '../tools/check-study-content.mjs'

const source = {
  id: 'source-1',
  sourceTitle: '固定版本',
  sourceUrl: 'https://example.test/source?v=1',
  accessedAt: '2026-10-07',
  license: 'Public domain',
  licenseEvidence: '公版依据',
  licenseEvidenceUrl: 'https://example.test/license'
}

const reviewedContent = {
  contentId: 'content-reviewed',
  title: '已核对内容',
  localPath: 'docs/学习资料/reviewed.md',
  status: 'reviewed',
  version: 1,
  sourceId: source.id
}

const draftContent = {
  contentId: 'content-draft',
  title: '草稿内容',
  localPath: 'docs/学习资料/draft.md',
  status: 'draft',
  version: 1,
  sourceId: source.id
}

const makeCard = (overrides: Record<string, unknown> = {}) => ({
  id: 'card-1',
  contentId: reviewedContent.contentId,
  categoryId: 'category-1',
  category: '类别一',
  question: '问题',
  answer: '答案',
  sourceUrl: source.sourceUrl,
  sourceTitle: source.sourceTitle,
  noteUrl: '/学习资料/reviewed#条目',
  status: 'reviewed',
  ...overrides
})

const fixture = (cards = [makeCard()]) => ({
  cards,
  catalog: { sources: [source], contents: [reviewedContent, draftContent] },
  existingPaths: new Set([reviewedContent.localPath, draftContent.localPath])
})

describe('study content validation', () => {
  it('accepts drafts but excludes draft cards from public output', () => {
    const cards = [
      makeCard(),
      makeCard({
        id: 'card-draft',
        contentId: draftContent.contentId,
        noteUrl: '/学习资料/draft#条目',
        status: 'draft'
      })
    ]
    const data = fixture(cards)
    assert.doesNotThrow(() => validateStudyContent(data))
    assert.deepEqual(selectReviewedCards(cards, data.catalog).map((card: { id: string }) => card.id), ['card-1'])
  })

  it('rejects duplicate card ids', () => {
    const data = fixture([makeCard(), makeCard()])
    assert.throws(() => validateStudyContent(data), /重复卡片 id/)
  })

  it('rejects a reviewed card that points to draft content', () => {
    const data = fixture([makeCard({ contentId: draftContent.contentId, noteUrl: '/学习资料/draft#条目' })])
    assert.throws(() => validateStudyContent(data), /已核对卡片引用草稿内容/)
  })

  it('requires card source title and URL to match the catalog source', () => {
    assert.throws(() => validateStudyContent(fixture([makeCard({ sourceUrl: 'https://example.test/other' })])), /来源 URL 与 catalog 不一致/)
    assert.throws(() => validateStudyContent(fixture([makeCard({ sourceTitle: '另一个版本' })])), /来源标题与 catalog 不一致/)
  })

  it('requires noteUrl to map to the content localPath and that file to exist', () => {
    assert.throws(() => validateStudyContent(fixture([makeCard({ noteUrl: '/学习资料/other#条目' })])), /noteUrl 与 localPath 不一致/)
    const data = fixture()
    data.existingPaths.delete(reviewedContent.localPath)
    assert.throws(() => validateStudyContent(data), /本地文件不存在/)
  })

  it('keeps one display name for each categoryId', () => {
    const data = fixture([makeCard(), makeCard({ id: 'card-2', category: '冲突名称' })])
    assert.throws(() => validateStudyContent(data), /对应了多个名称/)
  })
})
