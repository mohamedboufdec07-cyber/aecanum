const STORAGE_KEY = "arcanum-experience-layout";

const EXPERIENCES = {
  study: "Scholar's Study",
  atlas: "Explorer's Atlas",
  museum: "Grand Museum"
};

const MORPH_DURATION = 1560;
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function initExperienceSwitcher() {
  const root = document.querySelector("#experienceSwitcher");
  const trigger = document.querySelector("#experienceSwitchButton");
  const menu = document.querySelector("#experienceMenu");
  const activeName = document.querySelector("#activeExperienceName");
  const options = [...document.querySelectorAll("[data-layout-choice]")];

  if (!root || !trigger || !menu || !activeName || !options.length) return;

  let currentLayout = "study";
  let transitionInProgress = false;

  const closeMenu = ({ returnFocus = false } = {}) => {
    menu.hidden = true;
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus();
  };

  const setExperience = (layout, { persist = true } = {}) => {
    const safeLayout = Object.prototype.hasOwnProperty.call(EXPERIENCES, layout) ? layout : "study";
    document.body.dataset.layout = safeLayout;
    currentLayout = safeLayout;
    activeName.textContent = EXPERIENCES[safeLayout];

    options.forEach((option) => {
      const selected = option.dataset.layoutChoice === safeLayout;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, safeLayout);
      } catch (error) {
        // The selected experience still works when browser storage is unavailable.
      }
    }

    document.dispatchEvent(new CustomEvent("arcanum:experiencechange", {
      detail: { layout: safeLayout, name: EXPERIENCES[safeLayout] }
    }));
  };

  let initialLayout = "study";
  try {
    initialLayout = localStorage.getItem(STORAGE_KEY) || "study";
  } catch (error) {
    // Private browsing or storage restrictions should not prevent startup.
  }
  setExperience(initialLayout, { persist: false });

  trigger.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    root.classList.toggle("is-open", opening);
    trigger.setAttribute("aria-expanded", String(opening));
    if (opening) {
      const selected = options.find((option) => option.getAttribute("aria-pressed") === "true");
      (selected || options[0]).focus();
    }
  });

  const morphToExperience = async (layout, originRect) => {
    if (transitionInProgress || layout === currentLayout) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || typeof Element.prototype.animate !== "function") {
      setExperience(layout);
      return;
    }

    transitionInProgress = true;
    options.forEach((option) => { option.disabled = true; });
    trigger.disabled = true;

    const x = originRect.left + originRect.width / 2;
    const y = originRect.top + originRect.height / 2;
    const overlay = document.createElement("div");
    overlay.className = `experience-morph-overlay morph-to-${layout}`;
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.setProperty("--morph-x", `${x}px`);
    overlay.style.setProperty("--morph-y", `${y}px`);

    const seal = document.createElement("div");
    seal.className = "experience-morph-seal";
    const symbol = document.createElement("span");
    symbol.className = "morph-seal-symbol";
    symbol.textContent = layout === "atlas" ? "⌖" : layout === "museum" ? "✥" : "✧";
    const wordmark = document.createElement("strong");
    wordmark.textContent = "ARCANUM";
    const destination = document.createElement("small");
    destination.textContent = EXPERIENCES[layout];
    seal.append(symbol, wordmark, destination);
    overlay.append(seal);
    document.body.append(overlay);
    document.body.classList.add("is-experience-morphing");

    const animation = overlay.animate([
      {
        clipPath: "circle(0px at var(--morph-x) var(--morph-y))",
        opacity: 0.55,
        transform: "rotate(-17deg) scale(.24)",
        borderRadius: "50%",
        filter: "blur(9px)"
      },
      {
        offset: 0.38,
        clipPath: "circle(150vmax at var(--morph-x) var(--morph-y))",
        opacity: 1,
        transform: "rotate(7deg) scale(1.06)",
        borderRadius: "50%",
        filter: "blur(0px)"
      },
      {
        offset: 0.50,
        clipPath: "circle(150vmax at var(--morph-x) var(--morph-y))",
        opacity: 1,
        transform: "rotate(0deg) scale(1)",
        borderRadius: "0%",
        filter: "blur(0px)"
      },
      {
        offset: 0.64,
        clipPath: "circle(150vmax at var(--morph-x) var(--morph-y))",
        opacity: 1,
        transform: "rotate(0deg) scale(1)",
        borderRadius: "0%",
        filter: "blur(0px)"
      },
      {
        clipPath: "circle(0px at var(--morph-x) var(--morph-y))",
        opacity: 0,
        transform: "rotate(-8deg) scale(.82)",
        borderRadius: "50%",
        filter: "blur(8px)"
      }
    ], {
      duration: MORPH_DURATION,
      easing: "cubic-bezier(.7, 0, .18, 1)",
      fill: "forwards"
    });

    // Change the actual page structure while the parchment seal covers the screen.
    await wait(Math.round(MORPH_DURATION * 0.53));
    setExperience(layout);
    document.body.classList.add("is-layout-unfolding");

    try {
      await animation.finished;
    } catch (error) {
      // If the browser cancels an animation, still finish the layout change cleanly.
    }

    await wait(180);
    document.body.classList.remove("is-layout-unfolding", "is-experience-morphing");
    overlay.remove();
    options.forEach((option) => { option.disabled = false; });
    trigger.disabled = false;
    transitionInProgress = false;
  };

  options.forEach((option) => {
    option.addEventListener("click", () => {
      const nextLayout = option.dataset.layoutChoice;
      const originRect = option.getBoundingClientRect();
      closeMenu();
      trigger.focus();
      morphToExperience(nextLayout, originRect);
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) closeMenu({ returnFocus: true });
  });
}
