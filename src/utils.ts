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

export async function getTicketNumbers(is: 'issue' | 'pull-request'): Promise<number[]> {
  const per_page = 100;
  const items = [];
  for (let page = 1; page < 100; ++page) {
    const result = await octokit.request(`GET /search/issues`, {
      q: `repo:microsoft/playwright state:open is:${is} no:label no:assignee`,
      page,
      per_page,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    items.push(...result.data.items);
    if (result.data.items.length < per_page)
      break;
  }
  return items.map(item => item.number);
}

export async function getData(): Promise<{ issues: Ticket[], pullRequests: Ticket[] }> {
    const [issueNumbers, pullRequestNumbers] = await Promise.all([
      getTicketNumbers('issue'),
      getTicketNumbers('pull-request')
    ]);
    const query = `
    fragment IssueParts on Issue {
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
      repository(owner: "microsoft", name: "playwright") {
        ${issueNumbers.map((number, index) => `issue${index}: issue(number: ${number}) { ...IssueParts }`).join('\n')}
        ${pullRequestNumbers.map((number, index) => `pullRequest${index}: pullRequest(number: ${number}) { ...PullRequestParts }`).join('\n')}
      }
    }
    `;

    function toTicket(issue: any): Ticket {
      const comments = [
        issue,
        ...issue.comments.nodes,
        ...(issue.reviews?.nodes ?? []),
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

    const { repository } = await octokit.graphql<any>(query)
    const issues: Ticket[] = [];
    const pullRequests: Ticket[] = [];
    for (const [key, value] of Object.entries(repository)) {
      if (key.startsWith('issue')) {
        issues.push(toTicket(value));
      } else if (key.startsWith('pullRequest')) {
        pullRequests.push(toTicket(value));
      }
    }

    return { issues, pullRequests };
}