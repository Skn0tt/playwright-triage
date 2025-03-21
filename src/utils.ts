import { differenceInBusinessDays } from "date-fns";
import { Octokit } from '@octokit/core';

const octokit = new Octokit({
  auth: import.meta.env.GITHUB_TOKEN,
});


export interface Ticket {
    url: string;
    titleHTML: string;
    createdAt: Date;
    labelCount: number;
    assigneeCount: number;
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
    const query = `
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
      assignees {
        totalCount
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
      assignees {
        totalCount
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
      search(query: "repo:microsoft/playwright state:open no:label", type: ISSUE, first: 100) {
        nodes {
          ... on Issue { ...IssueParts }
          ... on PullRequest { ...PullRequestParts }
        }
      }
    }
    `;

    function toTicket(issue: any): Ticket {
      const comments = [
        issue,
        ...issue.comments.nodes,
      ]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((c) => ({
          author: c.author.login,
          createdAt: new Date(c.createdAt),
        }))
        .filter((c) => !isBot(c.author));

      return {
        ...issue,
        createdAt: new Date(issue.createdAt),
        assigneeCount: issue.assignees.totalCount,
        labelCount: issue.labels.totalCount,
        comments,
      };
    }

    const { search: { nodes: tickets } } = await octokit.graphql<any>(query)
    const issues: Ticket[] = [];
    const pullRequests: Ticket[] = [];
    for (const ticket of tickets) {
      switch (ticket.__typename) {
        case 'Issue':
          issues.push(toTicket(ticket));
          break;
        case 'PullRequest':
          pullRequests.push(toTicket(ticket));
          break;
        default:
          throw new Error(`Unknown ticket type: ${ticket.__typename}`);
      }
    }

    return { issues, pullRequests };
}