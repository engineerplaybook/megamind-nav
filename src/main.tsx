import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Navbar from './components/Navbar';
import './index.css'

const ASSET_BASE = new URL('./', import.meta.url).href;

class WebNavbar extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    if (!this.root) {
      this.root = createRoot(this);
      this.root.render(
        <StrictMode>
          <Navbar assetBase={ASSET_BASE} />
        </StrictMode>
      );
    }
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

if (!customElements.get('engineering-playbook-nav')) {
  customElements.define('engineering-playbook-nav', WebNavbar);
}
