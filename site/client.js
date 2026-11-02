(() => {
  const clock = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const day = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.querySelectorAll('.js-now').forEach(el => { el.textContent = clock.format(new Date()); });
  document.querySelectorAll('.js-day').forEach(el => { el.textContent = day.format(new Date()); });
  const buttons = [...document.querySelectorAll('[data-select-section]')];
  const feeds = [...document.querySelectorAll('[data-feed]')];
  if (buttons.length && feeds.length) {
    for (const feed of feeds) {
      const cards = [...feed.querySelectorAll('[data-published]')];
      let visible = 0;
      for (const card of cards) {
        const timestamp = Date.parse(card.dataset.published);
        const age = Date.now() - timestamp;
        const show = Number.isFinite(timestamp) && age >= 0 && age < 86400000;
        card.hidden = !show;
        if (show) visible++;
      }
      const button = buttons.find(b => b.dataset.selectSection === feed.dataset.feed);
      if (button) { const count = button.querySelector('span'); if (count) count.textContent = String(visible); }
      if (visible === 0 && cards.length && !feed.querySelector('.empty-state')) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<span class="eyebrow">THE LAST 24 HOURS</span><h3>No approved bulletins in this period.</h3><p>Our archive retains earlier stories. We do not publish to meet a quota.</p>';
        feed.append(empty);
      }
    }
    const activate = section => {
      buttons.forEach(button => { const isActive = button.dataset.selectSection === section; button.classList.toggle('active', isActive); button.setAttribute('aria-pressed', String(isActive)); });
      feeds.forEach(feed => { feed.hidden = feed.dataset.feed !== section; });
    };
    buttons.forEach(button => button.addEventListener('click', () => activate(button.dataset.selectSection)));
  }
  const search = document.getElementById('archive-search');
  if (search) {
    const rows = [...document.querySelectorAll('.archive-entry')];
    const output = document.getElementById('search-count');
    const update = () => {
      const query = search.value.toLocaleLowerCase().trim();
      let matches = 0;
      rows.forEach(row => { const found = row.dataset.search.includes(query); row.hidden = !found; if (found) matches++; });
      if (output) output.textContent = rows.length ? `${matches} of ${rows.length} bulletin${rows.length === 1 ? '' : 's'} shown` : 'No bulletins published yet';
    };
    search.addEventListener('input', update);
    update();
  }
})();
