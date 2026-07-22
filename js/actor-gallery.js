// =========================================================================
// СКРИПТ ГАЛЕРЕЇ ТА ДИНАМІЧНОГО ІН'ЄКТУВАННЯ МОДАЛОК (ДЛЯ СТАТИЧНИХ СТОРІНОК)
// =========================================================================

const ACTOR_API_KEY = "d81559e3ee0e79ee39f56758f4897fff";

document.addEventListener("DOMContentLoaded", () => {
    const mediaContainer = document.getElementById("actor-media");
    if (mediaContainer) {
        const actorId = mediaContainer.getAttribute("data-tmdb-id");
        if (actorId) {
            initActorMediaGallery(actorId);
        }
    }
});

// 🚀 ЗАЛІЗНЕ ПЕРЕХОПЛЕННЯ КЛІКІВ: БЛОКУЄМО ПЕРЕХІД НА ГОЛОВНУ І ВІДКРИВАЄМО МОДАЛКУ ТУТ ЖЕ
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    
    if (href.includes('index.html?movie=') || href.includes('index.html?tv=') || href.includes('?movie=') || href.includes('?tv=')) {
        
        // Якщо це динамічна сторінка profile.html, вона обробляє модалку сама через onclick
        if (window.location.pathname.includes('profile.html')) {
            return; 
        }

        e.preventDefault(); // БЛОКУЄМО РЕДИРЕКТ НА index.html
        
        let type = 'movie';
        let id = null;
        
        const queryString = href.split('?')[1];
        if (queryString) {
            const urlParams = new URLSearchParams(queryString);
            if (urlParams.has('movie')) {
                type = 'movie';
                id = urlParams.get('movie');
            } else if (urlParams.has('tv')) {
                type = 'tv';
                id = urlParams.get('tv');
            }
        }
        
        if (id) {
            openInjectedModal(type, id);
        }
    }
});

// ГАЛЕРЕЯ ФОТО АКТОРІВ
async function initActorMediaGallery(actorId) {
    const mediaContainer = document.getElementById("actor-media");
    if (!mediaContainer) return;

    try {
        const res = await fetch(`https://api.themoviedb.org/3/person/${actorId}/images?api_key=${ACTOR_API_KEY}`);
        const data = await res.json();

        if (data.profiles && data.profiles.length > 0) {
            mediaContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; margin-top: 15px;">
                    ${data.profiles.slice(0, 12).map(img => `
                        <a href="https://image.tmdb.org/t/p/original${img.file_path}" target="_blank" style="display: block; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); transition: transform 0.2s;">
                            <img src="https://image.tmdb.org/t/p/w185${img.file_path}" style="width: 100%; height: 180px; object-fit: cover; display: block;" loading="lazy">
                        </a>
                    `).join('')}
                </div>
            `;
        } else {
            mediaContainer.innerHTML = '<p style="color: #535763; font-style: italic;">Фотографій не знайдено...</p>';
        }
    } catch (err) {
        mediaContainer.innerHTML = '<p style="color: #535763; font-style: italic;">Не вдалося завантажити фотографії...</p>';
    }
}

// 🚀 СТВОРЕННЯ ТА ВІДКРИТТЯ ПОВНОЦІННОЇ МОДАЛКИ НА СТАТИЧНІЙ СТОРІНЦІ
async function openInjectedModal(type, id) {
    if (!document.getElementById('injected-movie-modal')) {
        injectModalHTML();
    }

    const modal = document.getElementById('injected-movie-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const trailerIframe = document.getElementById('inj-trailer-iframe');
    if (trailerIframe) trailerIframe.src = "";
    
    const genresList = document.getElementById('inj-modal-genres-list');
    const actorsList = document.getElementById('inj-modal-actors-list');
    if (genresList) genresList.textContent = "Завантаження...";
    if (actorsList) actorsList.textContent = "Завантаження...";
    
    try {
        const response = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${ACTOR_API_KEY}&language=uk-UA`);
        const item = await response.json();

        const title = item.title || item.name || "Без назви";
        const date = item.release_date || item.first_air_date;
        const year = date ? date.substring(0, 4) : '----';

        document.getElementById('inj-modal-title').textContent = title;
        document.getElementById('inj-modal-year').textContent = `${year} • 4K, українська озвучка`;
        document.getElementById('inj-modal-rating').textContent = item.vote_average ? item.vote_average.toFixed(1) : '0.0';
        document.getElementById('inj-modal-overview').textContent = item.overview || "На жаль, опис українською мовою поки відсутній.";
        
        const posterEl = document.getElementById('inj-modal-poster');
        if (posterEl) {
            posterEl.src = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750/0c0d14/ffd600?text=No+Poster';
        }
        
        const heroEl = document.getElementById('inj-modal-hero');
        if (heroEl) {
            heroEl.style.backgroundImage = item.backdrop_path ? `url(https://image.tmdb.org/t/p/original${item.backdrop_path})` : 'none';
        }

        // Жанри
        if (genresList) {
            genresList.innerHTML = (item.genres && item.genres.length > 0) 
                ? item.genres.map(g => `<span class="genre-tag" style="background: rgba(255,214,0,0.1); color:#ffd600; padding:3px 8px; border-radius:4px; margin-right:5px; font-size:12px;">${escapeInjHtml(g.name)}</span>`).join('') 
                : "Невизначено";
        }

        // Актори (ПОВНІСТЮ ВИПРАВЛЕНО ШЛЯХ ДО АКТОРІВ БЕЗ ПОДВІЙНОГО actors/)
        if (actorsList) {
            fetch(`https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${ACTOR_API_KEY}&language=uk-UA`)
                .then(res => res.json())
                .then(creditsData => {
                    if (creditsData.cast && creditsData.cast.length > 0) {
                        const isInsideActorsFolder = window.location.pathname.includes('/actors/') || window.location.pathname.endsWith('/profile.html');
                        
                        actorsList.innerHTML = creditsData.cast.slice(0, 5).map(actor => {
                            let actorUrl;
                            if (typeof generatedActorsMap !== 'undefined' && generatedActorsMap[actor.id]) {
                                let rawPath = generatedActorsMap[actor.id];
                                if (isInsideActorsFolder) {
                                    // Очищаємо "actors/" або "/actors/", оскільки ми вже перебуваємо в папці actors/
                                    actorUrl = rawPath.replace(/^\/?actors\//, '');
                                } else {
                                    actorUrl = rawPath.startsWith('actors/') || rawPath.startsWith('/actors/') ? rawPath : `actors/${rawPath}`;
                                }
                            } else {
                                actorUrl = isInsideActorsFolder ? `profile.html?id=${actor.id}` : `actors/profile.html?id=${actor.id}`;
                            }
                            return `<a href="${actorUrl}" style="color: #ffd600; text-decoration: none; font-weight: 600;">${escapeInjHtml(actor.name)}</a>`;
                        }).join(', ');
                    } else {
                        actorsList.textContent = "Немає даних";
                    }
                }).catch(() => { actorsList.textContent = "Немає даних"; });
        }

        // Трейлер
        let tResponse = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${ACTOR_API_KEY}&language=uk-UA`);
        let tData = await tResponse.json();
        let trailer = tData.results ? tData.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') : null;
        
        if (!trailer) {
            tResponse = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${ACTOR_API_KEY}&language=en-US`);
            tData = await tResponse.json();
            trailer = tData.results ? tData.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') : null;
        }
        
        const trailerBox = document.querySelector('.inj-trailer-container');
        if (trailer && trailerIframe && trailerBox) {
            trailerBox.style.display = 'block';
            trailerIframe.src = `https://www.youtube.com/embed/${trailer.key}`;
        } else if (trailerBox) {
            trailerBox.style.display = 'none';
        }

    } catch (err) {
        console.error("Помилка модалки:", err);
    }
}

function injectModalHTML() {
    const div = document.createElement('div');
    div.innerHTML = `
    <div id="injected-movie-modal" class="modal">
        <div class="modal-content">
            <button class="close-modal-btn" onclick="closeInjectedModal()">
                <span class="material-icons">close</span>
            </button>

            <div id="inj-modal-hero" class="modal-hero">
                <div class="modal-hero-overlay"></div>
                <div class="modal-hero-meta">
                    <span id="inj-modal-rating" class="rating-badge">0.0</span>
                    <h2 id="inj-modal-title">Назва фільму</h2>
                    <p id="inj-modal-year" class="movie-meta">2026</p>
                </div>
            </div>

            <div class="modal-body">
                <div class="modal-details-grid">
                    <div class="modal-poster-side">
                        <img id="inj-modal-poster" src="" alt="Постер">
                    </div>
                    <div class="modal-desc-side">
                        <div class="expanded-meta-box">
                            <div class="meta-line">
                                <span class="meta-label">Жанри:</span>
                                <span id="inj-modal-genres-list" class="meta-value">...</span>
                            </div>
                            <div class="meta-line">
                                <span class="meta-label">У головних ролях:</span>
                                <span id="inj-modal-actors-list" class="meta-value">...</span>
                            </div>
                        </div>

                        <h3>Про що сюжет:</h3>
                        <p id="inj-modal-overview">Опис відсутній.</p>
                        
                        <div class="inj-trailer-container trailer-container">
                            <h3><span class="material-icons">play_circle</span> Офіційний трейлер</h3>
                            <div class="video-responsive">
                                <iframe id="inj-trailer-iframe" src="" frameborder="0" allowfullscreen></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.appendChild(div.firstElementChild);
}

function closeInjectedModal() {
    const modal = document.getElementById('injected-movie-modal');
    if (modal) {
        modal.classList.remove('active');
        const iframe = document.getElementById('inj-trailer-iframe');
        if (iframe) iframe.src = "";
    }
    document.body.style.overflow = 'auto';
}

function escapeInjHtml(str) { 
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); 
}
