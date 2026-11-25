import { View } from "gpui-kit";
import { checking, focused, nextCommand, openOverlay, props, setAgentOrder, agents, panes } from "herdr";
import { AgentSearch } from "./search.js";
import { renderBar } from "./bar.js";
import { renderBoard } from "./board.js";
import { boardCards, needsYou, nextCard, prevCard } from "./cards.js";
import { openChat, showBoard } from "./actions.js";

const PICK = {
  next: (cards) => nextCard(cards, focused()?.pane),
  prev: (cards) => prevCard(cards, focused()?.pane),
  needs: (cards) => needsYou(cards),
};

function openSearch() {
  openOverlay({ mod: "agent-board", props: { part: "search" }, kind: "dialog", width: 640, height: 0.6 });
}

/** The agent board; with props {part: "bar"} the header above it, {part: "search"} the Ctrl+P pop-up. */
export default class AgentBoard extends View {
  init(_props, cx) {
    if (props()?.part === "search") this.search = new AgentSearch(cx);
    // The bar is always shown, so it alone answers the agent-board.* keys.
    if (props()?.part !== "bar" || checking()) return;
    cx.spawn(async () => {
      for (;;) {
        const command = String(await nextCommand()).split(".").pop();
        if (command === "find") { openSearch(); continue; }
        if (command === "board") { showBoard(); continue; }
        const card = PICK[command]?.(boardCards(agents(), panes(), "all"));
        if (card) openChat(card);
      }
    });
  }

  render() {
    if (this.search) return this.search.render();
    if (props()?.part === "bar") return renderBar(this);
    setAgentOrder(boardCards(agents(), panes(), "all").map((c) => c.address));
    return renderBoard(this);
  }
}
