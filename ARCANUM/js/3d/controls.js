export function attachPointerControls(container, artifact, camera) {
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const onMove = (event) => {
    const rect = container.getBoundingClientRect();
    pointer.targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.55;
    pointer.targetX = ((event.clientY - rect.top) / rect.height - 0.5) * 0.32;
  };
  const onLeave = () => { pointer.targetX = 0; pointer.targetY = 0; };
  container.addEventListener("pointermove", onMove);
  container.addEventListener("pointerleave", onLeave);
  return {
    update() {
      pointer.x += (pointer.targetX - pointer.x) * 0.035;
      pointer.y += (pointer.targetY - pointer.y) * 0.035;
      artifact.rotation.x = pointer.x;
      artifact.rotation.y += (pointer.y - artifact.rotation.y) * 0.035;
      camera.position.x += (pointer.y * 0.45 - camera.position.x) * 0.018;
      camera.position.y += (-pointer.x * 0.35 - camera.position.y) * 0.018;
      camera.lookAt(0, 0, 0);
    },
    dispose() {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
    }
  };
}
