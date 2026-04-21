#!/bin/bash

# merge-all-prs.sh
# A script to merge all open pull requests sequentially with safety checks and error handling.

set -e

# Function to merge a pull request
merge_pr() {
    pr_number=$1
    echo "Merging PR #$pr_number..."
    # Check out the PR branch
    git fetch origin pull/$pr_number/head:pr-$pr_number
    git checkout pr-$pr_number

    # Check for conflicts
    if ! git merge --no-commit main; then
        echo "Merge conflict in PR #$pr_number. Please resolve conflicts manually."
        git checkout main
        exit 1
    fi

    # Commit the merge
    git commit -m "Merge PR #$pr_number"
    git checkout main
}

# Get the list of open pull requests
pr_numbers=$(gh pr list --state open --json number --jq '.[].number')

if [ -z "$pr_numbers" ]; then
    echo "No open pull requests to merge."
    exit 0
fi

# Merge each pull request
for pr_number in $pr_numbers; do
    merge_pr "$pr_number"
done

echo "All open pull requests have been merged!"