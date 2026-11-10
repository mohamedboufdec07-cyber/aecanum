import { initArtifactScene } from "./3d/scene.js";
import { initNavigation } from "./navigation.js";
import { initExperienceSwitcher } from "./experience-switcher.js";
import { initAnimations } from "./animations.js";
import { civilizations } from "./data/civilizations.js";
import { historicalEvents } from "./data/historical-events.js";
import { renderTimeline } from "./timeline.js";
import { openArchiveWorld, closeArchiveWorld } from "./3d/archive-world.js";

function renderCivilizations() {
  const grid = document.querySelector("#civilizationGrid");
  if (!grid) return;
  grid.innerHTML = civilizations.map((item, index) => `
    <button class="civilization-card" type="button" data-civilization-index="${index}" aria-label="Enter the ${item.name} archive">
      <div class="civilization-art" style="background-image:url('${item.image}')"></div>
      <div class="civilization-details">
        <span class="card-number">${item.number} / ${item.tag}</span>
        <h3>${item.name}</h3>
        <p>${item.period}<br>${item.summary}</p>
        <span class="card-link">Enter the 3D archive <b>↗</b></span>
      </div>
    </button>
  `).join("");
}

function boot() {
  document.querySelector("#year").textContent = new Date().getFullYear();
  renderCivilizations();
  renderTimeline(historicalEvents);
  document.querySelectorAll('.civilization-card').forEach((card) => {
    card.addEventListener('click', () => openArchiveWorld(civilizations[Number(card.dataset.civilizationIndex)]));
  });
  document.querySelector('#closeArchive')?.addEventListener('click', closeArchiveWorld);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeArchiveWorld(); });
  initNavigation();
  initExperienceSwitcher();
  initAnimations();

  const canvas = document.querySelector("#artifactCanvas");
  let sceneController = null;
  if (canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    try {
      sceneController = initArtifactScene(canvas);
    } catch (error) {
      console.error("The 3D scene could not start:", error);
      document.querySelector("#heroArt")?.classList.add("scene-fallback");
    }
  }
  window.addEventListener("pagehide", () => sceneController?.dispose(), { once: true });
}

boot();
