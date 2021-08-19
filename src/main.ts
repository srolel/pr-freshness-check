import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const {context} = github

    // This should be a token with access to your repository scoped in as a secret.
    // The YML workflow will need to set myToken with the GitHub Secret Token
    // GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
    const githubToken = core.getInput('token', {required: true})

    const octokit = github.getOctokit(githubToken)

    const {
      data: {default_branch}
    } = await octokit.rest.repos.get({
      ...context.repo
    })

    const {
      data: {commit: defaultBranchCommit}
    } = await octokit.rest.repos.getBranch({
      ...context.repo,
      branch: default_branch
    })

    const defaultBranchCommitDate =
      defaultBranchCommit.commit.committer?.date ||
      defaultBranchCommit.commit.author?.date

    core.debug(
      `${default_branch} branch sha ${defaultBranchCommit.sha} commit date: ${defaultBranchCommitDate}`
    )

    const {data: currentBranchCommit} = await octokit.rest.repos.getCommit({
      ...context.repo,
      ref: context.ref
    })

    const currentBranchCommitDate =
      currentBranchCommit.commit.committer?.date ||
      currentBranchCommit.commit.author?.date

    core.debug(
      `sha ${currentBranchCommit.sha} commit date: ${currentBranchCommitDate}`
    )
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
