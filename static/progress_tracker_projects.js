/* Progress Tracker project list: each project is a fully separate tracker
   (its own categories, items, weeks, and progress entries — see
   progress_tracker.js for the per-project page). Listed alphabetically by
   the server (pm_db.list_progress_projects). */
(function () {
  const container = document.getElementById("pt-projects");

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

  function renderProjects(projects) {
    container.innerHTML = "";
    projects.forEach((project) => {
      const link = document.createElement("a");
      link.className = "pt-project-card";
      link.href = `/progress-tracker/${project.id}`;
      link.textContent = project.name;
      container.appendChild(link);
    });
    container.appendChild(createAddProjectControl());
  }

  function createAddProjectControl() {
    const wrap = document.createElement("div");
    wrap.className = "pt-add-project";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pt-add-project-btn";
    btn.textContent = "+ New Project";
    btn.addEventListener("click", () => {
      wrap.innerHTML = "";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "pt-add-project-input";
      input.placeholder = "Project name";
      wrap.appendChild(input);
      input.focus();

      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (!name) {
          init();
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
          init();
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        } else if (e.key === "Escape") {
          done = true;
          init();
        }
      });
    });

    wrap.appendChild(btn);
    return wrap;
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

  init();
})();
