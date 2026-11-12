"use client";
import { Component, type ReactNode } from "react";
import Link from "next/link";
export default class SceneBoundary extends Component<
  { id: string; title: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section
        id={this.props.id}
        className="world-scene world-loading"
        role="status"
        data-world-error
      >
        <span className="world-eyebrow">A pause in the journey</span>
        <h2>{this.props.title}</h2>
        <p>This chapter could not open. Your atlas is still here.</p>
        <Link href="/explore" className="world-link">
          Explore the destination directory ↗
        </Link>
        <button className="world-link" onClick={() => location.reload()}>
          Reload the experience ↗
        </button>
      </section>
    );
  }
}
