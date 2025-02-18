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

export function requiresAttention(ticket: Ticket) {
  const lastComment = ticket.comments[ticket.comments.length - 1];
  return !isMaintainer(lastComment.author);
}

export function isStale(ticket: Ticket) {
  const lastComment = ticket.comments[ticket.comments.length - 1]
  return lastComment.createdAt < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
}

export async function getData(): Promise<{ issues: Ticket[], pullRequests: Ticket[] }> {
    const query = `
    {
      repository(owner: "microsoft", name: "playwright") {
        issues(
          orderBy: {field: CREATED_AT, direction: DESC}
          states: OPEN
          first: 100
        ) {
          totalCount
          nodes {
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
        }
        
        pullRequests(
          orderBy: {field: CREATED_AT, direction: DESC}
          states: OPEN
          first: 100
        ) {
          totalCount
          nodes {
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
        }
      }
    }
    `;
    
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: {
        Authorization: `Bearer ${import.meta.env.GITHUB_TOKEN}`,
      },
    });
    const {
      data: {
        repository: {
          issues: { nodes: issues },
          pullRequests: { nodes: pullRequests }
        },
      },
    } = await response.json();

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
        }));

      return {
        ...issue,
        createdAt: new Date(issue.createdAt),
        assigneeCount: issue.assignees.totalCount,
        labelCount: issue.labels.totalCount,
        comments,
      };
    }

    return {
      issues: issues.map(toTicket),
      pullRequests: pullRequests.map(toTicket)
    };
}