import { differenceInBusinessDays } from "date-fns";
import { Octokit } from '@octokit/core';
import { execSync } from 'child_process';

import gql from 'graphql-tag';
import { print } from 'graphql';

import type { Issue, PullRequest } from "@octokit/graphql-schema";

let GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN
if (!import.meta.env.PROD && !GITHUB_TOKEN) {
  GITHUB_TOKEN = execSync('gh auth token', { encoding: 'utf8', stdio: 'pipe' }).trim();
  console.log('Using GitHub token from gh CLI');
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});


export interface Ticket {
    url: string;
    titleHTML: string;
    createdAt: Date;
    labelCount: number;
    assigneeCount: number;
    assignees: string[];
    comments: {
        author: string;
        createdAt: Date;
    }[];
}

export function isMaintainer(login: string) {
    return [
        "dgozman",
        "mxschmitt",
        "yury-s",
        "pavelfeldman",
        "Skn0tt",
        "agg23",
    ].includes(login);
}

export function isBot(login: string) {
  return [
      "github-actions",
      "copilot-pull-request-reviewer",
      "copilot-swe-agent",
  ].includes(login);
}

export function requiresAttention(ticket: Ticket) {
  const lastComment = ticket.comments[ticket.comments.length - 1];
  return !isMaintainer(lastComment.author);
}

export function isStale(ticket: Ticket) {
  const lastComment = ticket.comments[ticket.comments.length - 1]

  return differenceInBusinessDays(new Date(), lastComment.createdAt) > 3;
}

export async function getData(): Promise<{ issues: Ticket[], pullRequests: Ticket[] }> {
    const query = gql`
    fragment IssueParts on Issue {
      __typename
      titleHTML
      url
      createdAt
      author {
        login
      }
      labels {
        totalCount
      }
      assignees(first: 10) {
        totalCount
        nodes {
          login
        }
      }
      comments(last: 100) {
        nodes {
          createdAt
          author {
            login
          }
        }
      }
    }
    fragment PullRequestParts on PullRequest {
      __typename
      titleHTML
      url
      createdAt
      author {
        login
      }
      labels {
        totalCount
      }
      assignees(first: 10) {
        totalCount
        nodes {
          login
        }
      }
      comments(last: 100) {
        nodes {
          createdAt
          author {
            login
          }
        }
      }
      reviews(last: 100) {
        nodes {
          createdAt
          author {
            login
          }
        }
      }
    }
      
    query {
      issues: search(query: "repo:microsoft/playwright state:open no:label is:issue", type: ISSUE, first: 100) {
        nodes {
          ... on Issue { ...IssueParts }
        }
      }
      pullRequests: search(query: "repo:microsoft/playwright state:open no:label is:pr -is:draft", type: ISSUE, first: 100) {
        nodes {
          ... on PullRequest { ...PullRequestParts }
        }
      }
    }
    `;

    function toTicket(issue: Issue | PullRequest): Ticket {
      const comments = [
        issue,
        ...(issue.comments.nodes ?? []),
        ...(issue.__typename === 'PullRequest' ? issue.reviews?.nodes ?? [] : []),
      ]
        .map((c) => ({
          author: c!.author?.login!,
          createdAt: new Date(c!.createdAt),
        }))
        .sort((a, b) => +a!.createdAt - +b!.createdAt)
        .filter((c) => !isBot(c.author!));

      return {
        ...issue,
        createdAt: new Date(issue.createdAt),
        assigneeCount: issue.assignees.totalCount,
        labelCount: issue.labels?.totalCount ?? 0,
        assignees: (issue.assignees.nodes?.map(a => a?.login).filter((login): login is string => Boolean(login)) ?? []),
        comments,
      };
    }

    const { issues: { nodes: ticketNodes }, pullRequests: { nodes: pullRequestNodes } } = await octokit.graphql<{ issues: { nodes: Issue[] }; pullRequests: { nodes: PullRequest[] } }>(print(query))
    const issues: Ticket[] = ticketNodes.map(toTicket);
    const pullRequests: Ticket[] = pullRequestNodes.map(toTicket);
    return { issues, pullRequests };
}