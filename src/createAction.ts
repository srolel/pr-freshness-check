export function createAction(
  core: typeof import('@actions/core'),
  github: typeof import('@actions/github')
): () => Promise<void> {
  return async () => {
    try {
      const {context} = github

      if (!context.payload.pull_request) {
        throw new Error(
          `this action is only support for pull_request events! received event ${context.eventName}`
        )
      }

      // This should be a token with access to your repository scoped in as a secret.
      // The YML workflow will need to set myToken with the GitHub Secret Token
      // GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
      const githubToken = core.getInput('GITHUB_TOKEN', {required: true})
      const freshnessHours = Number(
        core.getInput('freshnessHours', {required: true})
      )

      const octokit = github.getOctokit(githubToken)

      const pullRequestRef = context.ref
      const pullRequestBaseRef: string =
        context.payload.pull_request['base']?.['ref']

      if (!pullRequestBaseRef) {
        throw new Error('Could not determine base branch from payload')
      }

      const {
        data: {commit: targetBranchHeadCommit}
      } = await octokit.rest.repos.getBranch({
        ...context.repo,
        branch: pullRequestBaseRef
      })

      const targetBranchHeadCommitDate =
        targetBranchHeadCommit.commit.committer?.date ||
        targetBranchHeadCommit.commit.author?.date

      if (!targetBranchHeadCommitDate) {
        throw new Error(
          `Could not determine HEAD timestamp of branch ${pullRequestBaseRef}`
        )
      }

      core.info(
        `${pullRequestBaseRef} branch sha ${targetBranchHeadCommit.sha} commit date: ${targetBranchHeadCommitDate}`
      )

      const baseCommitSha: string =
        context.payload.pull_request['base']?.['sha']

      if (!baseCommitSha) {
        throw new Error(
          `Could not determine base SHA of branch ${pullRequestRef}`
        )
      }

      const {
        data: currentBranchBaseCommit
      } = await octokit.rest.repos.getCommit({
        ...context.repo,
        ref: baseCommitSha
      })

      const currentBranchBaseCommitDate =
        currentBranchBaseCommit.commit.committer?.date ||
        currentBranchBaseCommit.commit.author?.date

      if (!currentBranchBaseCommitDate) {
        throw new Error(
          `Coult not determine HEAD timestamp of branch ${pullRequestRef}`
        )
      }

      core.info(
        `sha ${currentBranchBaseCommit.sha} commit date: ${currentBranchBaseCommitDate}`
      )

      const delta =
        +new Date(targetBranchHeadCommitDate) -
        +new Date(currentBranchBaseCommitDate)

      const deltaHours = Math.floor(delta / 1000 / 60 / 60)

      core.info(
        `HEAD (commit ${targetBranchHeadCommit.sha}) of branch ${pullRequestBaseRef} is ${deltaHours} hours ahead of base commit ${currentBranchBaseCommit.sha} in branch ${pullRequestRef}`
      )

      if (deltaHours > freshnessHours) {
        core.setFailed(
          `Commit is not fresh because it is more than ${freshnessHours} hours behind target branch HEAD (commit ${targetBranchHeadCommit})`
        )
        octokit.rest.pulls.createReviewComment({
          ...context.repo,
          pull_number: context.payload.pull_request.number,
          body: `Hi There! Looks like HEAD (commit ${
            targetBranchHeadCommit.sha
          }) of branch ${pullRequestBaseRef} is ${Math.abs(
            deltaHours
          )} hours ahead of base commit ${
            currentBranchBaseCommit.sha
          }. We require all merged branches to be no more than ${freshnessHours} hours behind the target branch. Please rebase the branch in this pull request!`
        })
      }
    } catch (error) {
      core.setFailed(error.message)
    }
  }
}
