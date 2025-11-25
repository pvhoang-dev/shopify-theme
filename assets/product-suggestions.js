class ProductSuggestions extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.productId = this.dataset.productId;

    this.relatedBtn = null;
    this.viewedBtn = null;
    this.relatedTab = null;
    this.viewedTab = null;
  }

  connectedCallback() {
    this.relatedBtn = this.querySelector(`#btn-related-${this.sectionId}`);
    this.viewedBtn = this.querySelector(`#btn-viewed-${this.sectionId}`);
    this.relatedTab = this.querySelector(`#related-tab-${this.sectionId}`);
    this.viewedTab = this.querySelector(`#viewed-tab-${this.sectionId}`);

    this.setupTabs();
  }

  setupTabs() {
    if (!this.relatedBtn || !this.viewedBtn) return;

    this.relatedBtn.addEventListener("click", () => {
      this.activateTab("related");
    });

    this.viewedBtn.addEventListener("click", () => {
      this.activateTab("viewed");
    });
  }

  activateTab(tabName) {
    [this.relatedBtn, this.viewedBtn].forEach((btn) => {
      btn?.classList.remove("active");
    });

    [this.relatedTab, this.viewedTab].forEach((tab) => {
      tab?.classList.add("hidden");
    });

    if (tabName === "related") {
      this.relatedBtn?.classList.add("active");
      this.relatedTab?.classList.remove("hidden");
    } else {
      this.viewedBtn?.classList.add("active");
      this.viewedTab?.classList.remove("hidden");
    }
  }
}

class RelatedProducts extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.productId = this.dataset.productId;
    this.loaded = false;
  }

  connectedCallback() {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries[0].isIntersecting) {
          obs.unobserve(this);
          this.loadProducts();
        }
      },
      { rootMargin: "0px 0px 400px 0px" }
    );
    observer.observe(this);
  }

  async loadProducts() {
    if (this.loaded) return;
    this.loaded = true;

    const url = `${
      window.Shopify.routes.root
    }recommendations/products?section_id=${this.sectionId}&product_id=${
      this.productId
    }&limit=${this.dataset.maxProducts || 10}&intent=related`;

    try {
      const response = await fetch(url);
      const text = await response.text();
      const html = document.createElement("div");
      html.innerHTML = text;
      this.renderContent(html);
    } catch (error) {
      console.error("Error loading related products:", error);
      this.showFallback();
    }
  }

  renderContent(html) {
    const relatedContent = html.querySelector(
      `#related-products-${this.sectionId}`
    );

    if (relatedContent?.innerHTML.trim().length) {
      this.innerHTML = relatedContent.innerHTML;
      this.classList.remove("hidden");

      if (this.querySelector(".carousel-wrapper")) {
        this.initCarousel();
      }
    } else {
      this.showFallback();
    }
  }

  showFallback() {
    const fallback = this.querySelector(".no-results-fallback");
    if (fallback) {
      fallback.classList.remove("hidden");
    }
  }

  initCarousel() {
    const container = this.querySelector(".product-grid");
    const prevBtn = this.querySelector(".carousel-prev");
    const nextBtn = this.querySelector(".carousel-next");
    if (!container || !prevBtn || !nextBtn) return;

    container.style.transition = `transform 300ms ease`;

    let currentIndex = 0;
    const items = container.querySelectorAll(".grid__item");
    const gap = 20;

    const update = () => {
      const visible = window.innerWidth >= 768 ? 4 : 2;
      const itemWidth =
        (container.parentElement.offsetWidth - gap * (visible - 1)) / visible;

      items.forEach((item) => (item.style.width = `${itemWidth}px`));
      container.style.transform = `translateX(-${
        currentIndex * (itemWidth + gap)
      }px)`;

      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex >= items.length - visible;
    };

    prevBtn.onclick = () => currentIndex > 0 && (currentIndex--, update());
    nextBtn.onclick = () => {
      const visible = window.innerWidth >= 768 ? 4 : 2;
      currentIndex < items.length - visible && (currentIndex++, update());
    };

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => ((currentIndex = 0), update()), 150);
    });

    update();
  }
}

class ViewedProducts extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.productId = this.dataset.productId;
    this.loaded = false;
    this.storageKey = "recently_viewed_products";
  }

  connectedCallback() {
    this.saveCurrentProduct();
    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries[0].isIntersecting) {
          obs.unobserve(this);
          this.loadProducts();
        }
      },
      { rootMargin: "0px 0px 400px 0px" }
    );
    observer.observe(this);
  }

  saveCurrentProduct() {
    let products = this.getViewedProducts();
    products = products.filter((id) => id !== this.productId);
    products.unshift(this.productId);
    products = products.slice(0, this.dataset.maxProducts || 10);

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(products));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  }

  getViewedProducts() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  async loadProducts() {
    if (this.loaded) return;
    this.loaded = true;

    let products = this.getViewedProducts().filter(
      (id) => id !== this.productId
    );

    if (!products.length) {
      this.showFallback();
      return;
    }

    const query = products.map((id) => `id:${id}`).join(" OR ");
    const url = `${window.Shopify.routes.root}search?section_id=${
      this.sectionId
    }&type=product&q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);
      const text = await response.text();
      const html = document.createElement("div");
      html.innerHTML = text;
      this.renderContent(html);
    } catch (error) {
      console.error("Error loading viewed products:", error);
      this.showFallback();
    }
  }

  renderContent(html) {
    const viewedContent = html.querySelector(
      `#viewed-products-${this.sectionId}`
    );

    if (viewedContent?.innerHTML.trim().length) {
      this.innerHTML = viewedContent.innerHTML;
      this.classList.remove("hidden");

      if (this.querySelector(".carousel-wrapper")) {
        this.initCarousel();
      }
    } else {
      this.showFallback();
    }
  }

  showFallback() {
    const fallback = this.querySelector(".no-results-fallback");
    if (fallback) {
      fallback.classList.remove("hidden");
    }
  }

  initCarousel() {
    const container = this.querySelector(".product-grid");
    const prevBtn = this.querySelector(".carousel-prev");
    const nextBtn = this.querySelector(".carousel-next");
    if (!container || !prevBtn || !nextBtn) return;

    container.style.transition = `transform 300ms ease`;

    let currentIndex = 0;
    const items = container.querySelectorAll(".grid__item");
    const gap = 20;

    const update = () => {
      const visible = window.innerWidth >= 768 ? 4 : 2;
      const itemWidth =
        (container.parentElement.offsetWidth - gap * (visible - 1)) / visible;

      items.forEach((item) => (item.style.width = `${itemWidth}px`));
      container.style.transform = `translateX(-${
        currentIndex * (itemWidth + gap)
      }px)`;

      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex >= items.length - visible;
    };

    prevBtn.onclick = () => currentIndex > 0 && (currentIndex--, update());
    nextBtn.onclick = () => {
      const visible = window.innerWidth >= 768 ? 4 : 2;
      currentIndex < items.length - visible && (currentIndex++, update());
    };

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => ((currentIndex = 0), update()), 150);
    });

    update();
  }
}

if (!customElements.get("product-suggestions")) {
  customElements.define("product-suggestions", ProductSuggestions);
}

if (!customElements.get("related-products")) {
  customElements.define("related-products", RelatedProducts);
}

if (!customElements.get("viewed-products")) {
  customElements.define("viewed-products", ViewedProducts);
}
