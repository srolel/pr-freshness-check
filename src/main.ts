import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const {context} = github

    // This should be a token with access to your repository scoped in as a secret.
    // The YML workflow will need to set myToken with the GitHub Secret Token
    // GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
    const githubToken = core.getInput('GITHUB_TOKEN', {required: true})
    const freshnessHours = Number(
      core.getInput('freshnessHours', {required: true})
    )

    const octokit = github.getOctokit(githubToken)
    octokit.rest.checks.create({})

    const currentBranchName = context.ref
    const targetBranchName: string =
      context.payload.pull_request?.['base']?.['ref']

    if (!targetBranchName) {
      throw new Error('Could not determine base branch from payload')
    }

    const {
      data: {commit: targetBranchCommit}
    } = await octokit.rest.repos.getBranch({
      ...context.repo,
      branch: targetBranchName
    })

    const targetBranchCommitDate =
      targetBranchCommit.commit.committer?.date ||
      targetBranchCommit.commit.author?.date

    if (!targetBranchCommitDate) {
      throw new Error(
        `Coult not determine HEAD timestamp of branch ${targetBranchName}`
      )
    }

    core.info(
      `${targetBranchName} branch sha ${targetBranchCommit.sha} commit date: ${targetBranchCommitDate}`
    )

    const baseCommitSha: string =
      context.payload.pull_request?.['base']?.['sha']

    if (!baseCommitSha) {
      throw new Error(
        `Coult not determine base SHA of branch ${currentBranchName}`
      )
    }

    const {data: currentBranchBaseCommit} = await octokit.rest.repos.getCommit({
      ...context.repo,
      ref: baseCommitSha
    })

    const currentBranchCommitDate =
      currentBranchBaseCommit.commit.committer?.date ||
      currentBranchBaseCommit.commit.author?.date

    if (!currentBranchCommitDate) {
      throw new Error(
        `Coult not determine HEAD timestamp of branch ${currentBranchName}`
      )
    }

    core.info(
      `sha ${currentBranchBaseCommit.sha} commit date: ${currentBranchCommitDate}`
    )

    const delta =
      +new Date(targetBranchCommitDate) - +new Date(currentBranchCommitDate)

    const deltaHours = Math.floor(delta / 1000 / 60 / 60)

    core.info(
      `HEAD (commit ${
        targetBranchCommit.sha
      }) of branch ${targetBranchName} is ${Math.abs(
        deltaHours
      )} hours ahead of base commit ${
        currentBranchBaseCommit.sha
      } in branch ${currentBranchName}`
    )

    if (deltaHours > freshnessHours) {
      core.setFailed(
        `Commit is not fresh because it is more than ${freshnessHours} hours behind target branch HEAD (commit ${targetBranchCommit})`
      )
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
