import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Navbar from './components/Navbar';
import './index.css'

class WebNavbar extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    if (!this.root) {
      this.root = createRoot(this);
      this.root.render(
        <StrictMode>
          <Navbar />
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
