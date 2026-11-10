export function renderTimeline(events) {
  const container = document.querySelector("#timelineList");
  if (!container) return;
  container.innerHTML = events.map((event) => `
    <article class="timeline-item">
      <div class="timeline-date">${event.date}</div>
      <div class="timeline-era">${event.title}</div>
      <p class="timeline-description">${event.description}</p>
    </article>
  `).join("");
}
