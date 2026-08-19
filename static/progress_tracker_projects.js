/* Progress Tracker project list: each project is a fully separate tracker
   (its own categories, items, weeks, and progress entries — see
   progress_tracker.js for the per-project page). Listed alphabetically by
   the server (pm_db.list_progress_projects). */
(function () {
  const container = document.getElementById("pt-projects");
  const actionsEl = document.getElementById("pt-project-actions");

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`Request to ${url} failed: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Mirrors severityFor() in progress_tracker.js — kept as its own small
  // copy here since this page never loads that file.
  function severityFor(percent) {
    if (percent >= 80) return { tone: "good", label: "Nearly complete" };
    if (percent >= 40) return { tone: "warning", label: "In progress" };
    if (percent > 0) return { tone: "critical", label: "Just started" };
    return { tone: "none", label: "Not started" };
  }

  function buildMeter(tone, clamped) {
    const meter = document.createElement("div");
    meter.className = "pt-card-meter";
    const fill = document.createElement("div");
    fill.className = `pt-card-meter-fill pt-card-meter-fill-${tone}`;
    fill.style.width = `${clamped}%`;
    meter.appendChild(fill);
    return meter;
  }

  function buildProjectCard(project) {
    const link = document.createElement("a");
    link.className = "pt-project-card";
    link.href = `/progress-tracker/${project.id}`;

    const name = document.createElement("div");
    name.className = "pt-project-card-name";
    name.textContent = project.name;
    link.appendChild(name);

    const percent = Number(project.completion_percent) || 0;
    const clamped = Math.min(100, Math.max(0, percent));
    const severity = severityFor(percent);

    const value = document.createElement("div");
    value.className = "pt-project-card-value";
    value.textContent = `${Math.round(clamped)}%`;
    link.appendChild(value);

    link.appendChild(buildMeter(severity.tone, clamped));

    const status = document.createElement("span");
    status.className = `pt-card-status pt-card-status-${severity.tone}`;
    status.textContent = severity.label;
    link.appendChild(status);

    return link;
  }

  function renderProjects(projects) {
    container.innerHTML = "";
    projects.forEach((project) => {
      container.appendChild(buildProjectCard(project));
    });
  }

  function renderAddProjectControl() {
    actionsEl.innerHTML = "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-primary";
    btn.textContent = "+ New Project";
    btn.addEventListener("click", () => {
      actionsEl.innerHTML = "";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "pt-input pt-project-add-input";
      input.placeholder = "Project name";
      actionsEl.appendChild(input);
      input.focus();

      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (!name) {
          renderAddProjectControl();
          return;
        }
        try {
          const project = await api("/api/progress/projects", {
            method: "POST",
            body: JSON.stringify({ name }),
          });
          window.location.href = `/progress-tracker/${project.id}`;
        } catch (err) {
          console.error(err);
          renderAddProjectControl();
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        } else if (e.key === "Escape") {
          done = true;
          renderAddProjectControl();
        }
      });
    });

    actionsEl.appendChild(btn);
  }

  async function init() {
    let projects = [];
    try {
      projects = await api("/api/progress/projects");
    } catch (err) {
      console.error(err);
    }
    renderProjects(projects);
  }

  renderAddProjectControl();
  init();
})();
