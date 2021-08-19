import {createAction} from '../src/createAction'
import {expect, test, describe, jest, beforeEach} from '@jest/globals'
import {context} from '@actions/github/lib/utils'

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

describe('createAction tests', () => {
  const core = {
    getInput: jest.fn(),
    setFailed: jest.fn(),
    info: jest.fn()
  }

  const octokit = {
    rest: {
      repos: {
        getBranch: jest.fn(),
        getCommit: jest.fn()
      },
      issues: {
        createComment: jest.fn()
      }
    }
  }

  const github = {
    context: {
      repo: {
        owner: 'owner',
        repo: 'repo'
      },
      ref: 'pr_ref',
      payload: {
        pull_request: {
          number: 1,
          base: {ref: 'base_ref'} as any
        }
      }
    },
    getOctokit: (token: string) => octokit
  }
  let run: () => Promise<void>

  beforeEach(() => {
    jest.resetAllMocks()
    github.context = {
      repo: {
        owner: 'owner',
        repo: 'repo'
      },
      ref: 'pr_ref',
      payload: {
        pull_request: {
          number: 1,
          base: {ref: 'base_ref', sha: 'base_sha'} as any
        }
      }
    }

    core.getInput.mockImplementationOnce(() => 'GITHUB_TOKEN')
    core.getInput.mockImplementationOnce(() => '1')

    run = createAction(core as any, github as any)
  })

  test('no base ref', async () => {
    github.context.payload.pull_request.base.ref = null
    await run()
    expect(core.setFailed.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "Could not determine base branch from payload",
        ],
      ]
    `)
  })

  test('pass', async () => {
    octokit.rest.repos.getBranch.mockImplementationOnce(() => ({
      data: {commit: {commit: {committer: {date: '2021-08-19T05:30:25.063Z'}}}}
    }))
    octokit.rest.repos.getCommit.mockImplementationOnce(() => ({
      data: {commit: {committer: {date: '2021-08-19T05:20:25.063Z'}}}
    }))
    await run()
    expect(octokit.rest.repos.getBranch).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [
            Object {
              "branch": "base_ref",
              "owner": "owner",
              "repo": "repo",
            },
          ],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": Object {
              "data": Object {
                "commit": Object {
                  "commit": Object {
                    "committer": Object {
                      "date": "2021-08-19T05:30:25.063Z",
                    },
                  },
                },
              },
            },
          },
        ],
      }
    `)
    expect(octokit.rest.repos.getCommit).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [
            Object {
              "owner": "owner",
              "ref": "base_sha",
              "repo": "repo",
            },
          ],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": Object {
              "data": Object {
                "commit": Object {
                  "committer": Object {
                    "date": "2021-08-19T05:20:25.063Z",
                  },
                },
              },
            },
          },
        ],
      }
    `)
    expect(core.setFailed.mock.calls).toMatchInlineSnapshot(`Array []`)
  })

  test('fail', async () => {
    octokit.rest.repos.getBranch.mockImplementationOnce(() => ({
      data: {
        commit: {
          sha: 'target_branch_head_commit_sha',
          commit: {committer: {date: '2021-08-19T05:30:25.063Z'}}
        }
      }
    }))
    octokit.rest.repos.getCommit.mockImplementationOnce(() => ({
      data: {
        sha: 'current_branch_base_commit_sha',
        commit: {committer: {date: '2021-08-19T04:30:25.063Z'}}
      }
    }))
    await run()
    expect(octokit.rest.repos.getBranch).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [
            Object {
              "branch": "base_ref",
              "owner": "owner",
              "repo": "repo",
            },
          ],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": Object {
              "data": Object {
                "commit": Object {
                  "commit": Object {
                    "committer": Object {
                      "date": "2021-08-19T05:30:25.063Z",
                    },
                  },
                  "sha": "target_branch_head_commit_sha",
                },
              },
            },
          },
        ],
      }
    `)
    expect(octokit.rest.repos.getCommit).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [
            Object {
              "owner": "owner",
              "ref": "base_sha",
              "repo": "repo",
            },
          ],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": Object {
              "data": Object {
                "commit": Object {
                  "committer": Object {
                    "date": "2021-08-19T04:30:25.063Z",
                  },
                },
                "sha": "current_branch_base_commit_sha",
              },
            },
          },
        ],
      }
    `)
    expect(core.setFailed.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    "PR Branch is not fresh because it is more than 1 hours behind target branch HEAD (commit target_branch_head_commit_sha)",
  ],
]
`)
    expect(octokit.rest.issues.createComment).toMatchInlineSnapshot(`
[MockFunction] {
  "calls": Array [
    Array [
      Object {
        "body": "Hi there! Looks like base_ref branch's HEAD commit target_branch_head_commit_sha is more than 1 hours ahead of base commit current_branch_base_commit_sha. We require all merged branches to be no more than 1 hours behind the target branch. Please rebase the branch in this pull request!",
        "issue_number": 1,
        "owner": "owner",
        "repo": "repo",
      },
    ],
  ],
  "results": Array [
    Object {
      "type": "return",
      "value": undefined,
    },
  ],
}
`)
  })
})
