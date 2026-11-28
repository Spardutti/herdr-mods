/** What "Close agent only" runs, worked out when pressed: a space's last pane takes the space with it. */
export function keepCommand(pane, space, paneList) {
  const tabs = new Set(space?.tabs?.map((t) => t.id) ?? []);
  const left = paneList.filter((p) => tabs.has(p.tab));
  const last = left.length === 1 && left[0].pane === pane;
  return last ? { name: "space.close", args: { id: space.id, confirmed: true } } : { name: "pane.close", args: { pane } };
}

export function otherAgents(pane, spaceId, agentList) {
  return agentList.filter((a) => a.space === spaceId && a.pane !== pane).length;
}
