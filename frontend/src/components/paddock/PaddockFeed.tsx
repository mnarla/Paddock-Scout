import { useEffect, useState } from "react";
import { ArrowUpRight, FileText, Newspaper } from "lucide-react";
import { TEAMS, type TeamId } from "@/data/teams";
import { API_BASE_URL } from "@/lib/config";

interface Story {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  kind: "Technical report" | "Team news";
}

interface Declaration {
  event: string;
  url: string;
  publishedAt: string | null;
  hasChanges: boolean | null;
  components: string[];
}

interface Feed {
  updatedAt: string | null;
  newsUpdatedAt: string | null;
  isStale?: boolean;
  teams: { name: string; id: TeamId; stories: Story[]; declarations: Declaration[] }[];
  fiaDocuments: { event: string; url: string; status: string }[];
  errors: string[];
}

const FILTERS = ["All updates", "FIA declarations", "Technical reports", "Team news"] as const;
type Filter = (typeof FILTERS)[number];

function displayDate(stamp: string) {
  return new Date(stamp).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaddockFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("All updates");
  const [teamFilter, setTeamFilter] = useState("all");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () =>
      fetch(`${API_BASE_URL}/api/paddock`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Feed unavailable");
          return response.json() as Promise<Feed>;
        })
        .then((data) => {
          setFeed(data);
          setError(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [retry]);

  if (!feed && !error)
    return (
      <div className="paddock-message" role="status">
        Loading team news and FIA declarations…
      </div>
    );
  if (!feed)
    return (
      <div className="paddock-message" role="alert">
        The paddock feed could not be loaded.{" "}
        <button onClick={() => setRetry(retry + 1)}>Try again</button>
      </div>
    );

  return (
    <div className="paddock-feed">
      <div className="paddock-explainer">
        <div>
          <FileText aria-hidden="true" />
          <p>
            <strong>What changed</strong>FIA submissions record components declared by each team and
            their intended purpose.
          </p>
        </div>
        <div>
          <Newspaper aria-hidden="true" />
          <p>
            <strong>How it performed</strong>Technical reporting and team comments describe the
            outcome. A declared upgrade is not proof of a pace gain.
          </p>
        </div>
      </div>
      <div className="paddock-freshness">
        <span>
          {feed.newsUpdatedAt
            ? `News checked ${displayDate(feed.newsUpdatedAt)}`
            : "News refresh in progress"}
          {feed.isStale ? " · refreshing saved feed" : " · latest 21 days"}
        </span>
        <span>
          {feed.updatedAt ? `FIA checked ${displayDate(feed.updatedAt)}` : "Checking FIA documents"}
        </span>
      </div>
      {(error || feed.errors.length > 0) && (
        <div className="paddock-message" role="status">
          {error ? "Refresh failed. Showing saved results. " : ""}
          {feed.errors.join(" ")}
        </div>
      )}
      {feed.fiaDocuments.map((document) => (
        <div key={document.event} className="paddock-document-status">
          <FileText aria-hidden="true" />
          <span>
            <strong>{document.event}</strong> ·{" "}
            {document.status === "available"
              ? "FIA submission available"
              : document.status === "not_published"
                ? "FIA submission not published yet"
                : "FIA document could not be checked"}
          </span>
          <a href={document.url} target="_blank" rel="noopener noreferrer">
            {document.status === "available" ? "Read PDF" : "FIA documents"}
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      ))}
      <div className="paddock-toolbar">
        <div className="paddock-filters" role="group" aria-label="Filter paddock updates">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === filter}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label>
          Team{" "}
          <select
            aria-label="Filter by team"
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
          >
            <option value="all">All constructors</option>
            {feed.teams.map((team) => (
              <option key={team.name} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!feed.teams.length && (
        <div className="paddock-message" role="status">
          The first feed refresh is running. Team updates will appear automatically.
        </div>
      )}
      <div className="paddock-teams">
        {feed.teams
          .filter((team) => teamFilter === "all" || team.name === teamFilter)
          .map((team) => {
            const stories = team.stories
              .filter(
                (story) =>
                  filter === "All updates" ||
                  (filter === "Technical reports" && story.kind === "Technical report") ||
                  (filter === "Team news" && story.kind === "Team news"),
              )
              .slice(0, 3);
            return (
              <section key={team.name} className="paddock-team">
                <h2>
                  <span
                    style={{ background: TEAMS[team.id]?.color ?? "#999" }}
                    aria-hidden="true"
                  />
                  {team.name}
                </h2>
                {(filter === "All updates" || filter === "FIA declarations") && (
                  <div className="paddock-declarations">
                    <h3>FIA declared changes</h3>
                    {!team.declarations.length && (
                      <p>No team declaration available in the checked documents.</p>
                    )}
                    {team.declarations.map((declaration) => (
                      <div key={declaration.event}>
                        <a href={declaration.url} target="_blank" rel="noopener noreferrer">
                          {declaration.event}
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                        <p>
                          {declaration.hasChanges === false
                            ? "No new updates declared at this event."
                            : declaration.components.length
                              ? declaration.components.join(" · ")
                              : "See the original submission for the team’s declaration."}
                        </p>
                        {declaration.publishedAt && (
                          <small>Published {declaration.publishedAt}</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {filter !== "FIA declarations" && (
                  <div className="paddock-stories">
                    <h3>Latest reporting</h3>
                    {!stories.length && (
                      <p>
                        No recent {filter === "Technical reports" ? "technical reports" : "stories"}{" "}
                        found in the checked sources. This does not confirm an unchanged car.
                      </p>
                    )}
                    {stories.map((story) => (
                      <article key={story.url}>
                        <div className="paddock-story-meta">
                          <span>{story.kind}</span>
                          <time dateTime={story.publishedAt}>{displayDate(story.publishedAt)}</time>
                        </div>
                        <a href={story.url} target="_blank" rel="noopener noreferrer">
                          {story.title}
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                        <small>{story.source}</small>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
      </div>
    </div>
  );
}
