// =========================================================================
// СКРИПТ ГАЛЕРЕЇ ТА ДИНАМІЧНОГО ІН'ЄКТУВАННЯ МОДАЛОК (ДЛЯ СТАТИЧНИХ СТОРІНОК)
// =========================================================================

const ACTOR_API_KEY = "d81559e3ee0e79ee39f56758f4897fff";
let galleryFirebaseInit = false;
let galleryDb = null;

document.addEventListener("DOMContentLoaded", () => {
    // Ініціалізуємо галерею фотографій актора
    const mediaContainer = document.getElementById("actor-media");
    if (mediaContainer) {
        const actorId = mediaContainer.getAttribute("data-tmdb-id");
        if (actorId) {
            initActorMediaGallery(actorId);
        }
    }
});

// ГЛОБАЛЬНЕ ПЕРЕХОПЛЕННЯ КЛІКІВ НА ФІЛЬМИ ТА СЕРІАЛИ
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    
    // Перехоплюємо переходи на головну з параметрами фільмів
    if (href.includes('index.html?movie=') || href.includes('index.html?tv=') || href.includes('?movie=') || href.includes('?tv=')) {
        
        // Якщо це динамічна сторінка (profile.html), там є власна модалка, ігноруємо
        if (document.getElementById('movie-modal') && window.location.pathname.includes('profile.html')) {
            return; 
        }

        e.preventDefault(); 
        
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

// --- ГАЛЕРЕЯ ФОТОГРАФІЙ АКТОРІВ ---
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
        console.error("Помилка завантаження фотографій актора:", err);
        mediaContainer.innerHTML = '<p style="color: #535763; font-style: italic;">Не вдалося завантажити фотографії...</p>';
    }
}

// --- СТВОРЕННЯ ТА ВІДКРИТТЯ МОДАЛЬНОГО ВІКНА ТРЕЙЛЕРА ---
async function openInjectedModal(type, id) {
    if (!document.getElementById('injected-movie-modal')) {
        injectModalHTML();
    }

    const modal = document.getElementById('injected-movie-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const trailerIframe = document.getElementById('inj-trailer-iframe');
    if (trailerIframe) trailerIframe.src = "";
    
    modal.setAttribute('data-current-id', id);
    modal.setAttribute('data-current-type', type);
    
    try {
        const response = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${ACTOR_API_KEY}&language=uk-UA`);
        const item = await response.json();
        
        window.currentInjectedMovieData = item;

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

        setupInjectedShareLinks(title, type, id);
        updateInjectedFavButton(id);
        initInjectedStars(id);
        
        await ensureGalleryFirebase();
        loadInjectedComments(id);
        checkInjectedSession();

        const genresList = document.getElementById('inj-modal-genres-list');
        if (genresList) {
            genresList.innerHTML = (item.genres && item.genres.length > 0) ? item.genres.map(g => `<span class="genre-tag">${escapeInjHtml(g.name)}</span>`).join('') : "Невизначено";
        }

        const actorsList = document.getElementById('inj-modal-actors-list');
        if (actorsList) {
            actorsList.textContent = "Завантаження...";
            fetch(`https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${ACTOR_API_KEY}&language=uk-UA`)
                .then(res => res.json())
                .then(creditsData => {
                    if (creditsData.cast && creditsData.cast.length > 0) {
                        actorsList.innerHTML = creditsData.cast.slice(0, 5).map(actor => {
                            let actorUrl = `profile.html?id=${actor.id}`;
                            if (typeof generatedActorsMap !== 'undefined' && generatedActorsMap[actor.id]) {
                                actorUrl = window.location.pathname.includes('actors/') ? `../${generatedActorsMap[actor.id]}` : generatedActorsMap[actor.id];
                            }
                            return `<a href="${actorUrl}" style="color: #ffd600; text-decoration: none; font-weight: 600;">${escapeInjHtml(actor.name)}</a>`;
                        }).join(', ');
                    } else {
                        actorsList.textContent = "Немає даних";
                    }
                }).catch(() => { actorsList.textContent = "Немає даних"; });
        }

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
        console.error("Помилка відкриття фільму в модалці:", err);
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
                <div class="action-bar">
                    <button id="inj-fav-btn" class="action-action-btn fav-btn" onclick="toggleInjectedFav()">
                        <span class="material-icons">bookmark_border</span> <span id="inj-fav-text">В обране</span>
                    </button>
                    
                    <div class="share-wrapper">
                        <button class="action-action-btn share-btn" onclick="document.getElementById('inj-share-drop').classList.toggle('active'); event.stopPropagation();">
                            <span class="material-icons">share</span> Поділитись
                        </button>
                        <div id="inj-share-drop" class="share-dropdown">
                            <a id="inj-share-tg" href="#" class="share-item tg" target="_blank">Telegram</a>
                            <a id="inj-share-viber" href="#" class="share-item viber" target="_blank">Viber</a>
                        </div>
                    </div>
                </div>

                <div class="modal-details-grid">
                    <div class="modal-poster-side">
                        <img id="inj-modal-poster" src="" alt="Постер">
                        
                        <div class="user-rating-section">
                            <h4>Ваша оцінка:</h4>
                            <div class="stars-container" id="inj-stars-rating">
                                <span class="material-icons star" data-value="1">star_border</span>
                                <span class="material-icons star" data-value="2">star_border</span>
                                <span class="material-icons star" data-value="3">star_border</span>
                                <span class="material-icons star" data-value="4">star_border</span>
                                <span class="material-icons star" data-value="5">star_border</span>
                            </div>
                            <span id="inj-rating-status" class="rating-status">Натисніть для голосування</span>
                        </div>
                    </div>
                    <div class="modal-desc-side">
                        <div class="expanded-meta-box">
                            <div class="meta-line">
                                <span class="meta-label">Жанри:</span>
                                <span id="inj-modal-genres-list" class="meta-value">Завантаження...</span>
                            </div>
                            <div class="meta-line">
                                <span class="meta-label">Актори:</span>
                                <span id="inj-modal-actors-list" class="meta-value">Завантаження...</span>
                            </div>
                        </div>

                        <h3>Про що сюжет:</h3>
                        <p id="inj-modal-overview">Опис відсутній.</p>
                        
                        <div class="inj-trailer-container trailer-container">
                            <h3><span class="material-icons">play_circle</span> Трейлер</h3>
                            <div class="video-responsive">
                                <iframe id="inj-trailer-iframe" src="" frameborder="0" allowfullscreen></iframe>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="comments-section">
                    <h3><span class="material-icons">forum</span> Обговорення</h3>
                    <form id="inj-comment-form" class="comment-form">
                        <input type="text" id="inj-comment-name" placeholder="Ваше ім'я" readonly required style="opacity: 0.6; background-color: #0c0d14;">
                        <textarea id="inj-comment-text" rows="3" placeholder="Залишіть свій відгук..." required></textarea>
                        <button type="submit" class="submit-comment-btn">Відправити</button>
                    </form>
                    <div id="inj-comments-list" class="comments-list"></div>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.appendChild(div.firstElementChild);

    const starsContainer = document.getElementById('inj-stars-rating');
    if (starsContainer) {
        starsContainer.querySelectorAll('.star').forEach(star => {
            star.onclick = async function() {
                const val = parseInt(star.getAttribute('data-value'));
                const modal = document.getElementById('injected-movie-modal');
                const movieId = modal.getAttribute('data-current-id');
                const user = localStorage.getItem('peerplay_username');
                
                localStorage.setItem(`rating_${movieId}`, val);
                document.getElementById('inj-rating-status').innerHTML = `Оцінка: <span style="color: #ffd600;">${val} з 5</span>`;
                
                starsContainer.querySelectorAll('.star').forEach(s => { 
                    const sVal = parseInt(s.getAttribute('data-value')); 
                    s.textContent = sVal <= val ? 'star' : 'star_border'; 
                });

                if (user && galleryDb) {
                    try {
                        await galleryDb.collection("ratings").doc(`${user}_${movieId}`).set({
                            username: user, movieId: movieId.toString(), rating: val, updated_at: new Date()
                        });
                    } catch (e) {}
                }
            };
        });
    }

    const commentForm = document.getElementById('inj-comment-form');
    if (commentForm) {
        commentForm.onsubmit = async function(e) {
            e.preventDefault();
            const modal = document.getElementById('injected-movie-modal');
            const movieId = modal.getAttribute('data-current-id');
            const user = localStorage.getItem('peerplay_username');
            
            if (!movieId || !user || !galleryDb) return;
            
            const commentText = document.getElementById('inj-comment-text');
            const text = commentText.value.trim();
            const dateStr = new Date().toLocaleDateString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            
            try {
                await galleryDb.collection("comments").add({
                    movieId: movieId.toString(), name: user, text: text, date: dateStr, raw_date: Date.now()
                });
                commentText.value = '';
                loadInjectedComments(movieId);
            } catch (err) {}
        };
    }

    document.addEventListener('click', () => {
        const drop = document.getElementById('inj-share-drop');
        if(drop) drop.classList.remove('active');
    });
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

function setupInjectedShareLinks(movieTitle, type, id) {
    const mainSiteUrl = window.location.origin + window.location.pathname.replace(/actors\/.+/, 'index.html');
    const shareUrl = `${mainSiteUrl}?${type}=${id}`;
    const messageText = `Раджу трейлер "${movieTitle}" на PeerPlay TV: ${shareUrl}`;
    
    const tg = document.getElementById('inj-share-tg');
    const viber = document.getElementById('inj-share-viber');
    if (tg) tg.href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Рекомендую "${movieTitle}" на PeerPlay TV! 🚀`)}`;
    if (viber) viber.href = `viber://forward?text=${encodeURIComponent(messageText)}`;
}

function toggleInjectedFav() {
    const modal = document.getElementById('injected-movie-modal');
    const id = modal.getAttribute('data-current-id');
    const type = modal.getAttribute('data-current-type');
    if (!id || !window.currentInjectedMovieData) return;
    
    let favorites = JSON.parse(localStorage.getItem('peerplay_favs')) || [];
    const index = favorites.findIndex(f => f.id.toString() === id.toString());
    
    if (index > -1) { 
        favorites.splice(index, 1); 
    } else { 
        window.currentInjectedMovieData.savedCategory = type; 
        favorites.push(window.currentInjectedMovieData); 
    }
    localStorage.setItem('peerplay_favs', JSON.stringify(favorites));
    updateInjectedFavButton(id);
}

function updateInjectedFavButton(id) {
    let favorites = JSON.parse(localStorage.getItem('peerplay_favs')) || [];
    const isFav = favorites.some(f => f.id.toString() === id.toString());
    const btn = document.getElementById('inj-fav-btn');
    if (!btn) return;
    const icon = btn.querySelector('.material-icons');
    const text = document.getElementById('inj-fav-text');
    
    if (isFav) { 
        if (icon) icon.textContent = 'bookmark'; 
        if (text) text.textContent = 'В Обраному'; 
        btn.style.borderColor = '#ffd600'; 
    } else { 
        if (icon) icon.textContent = 'bookmark_border'; 
        if (text) text.textContent = 'В обране'; 
        btn.style.borderColor = 'rgba(255,255,255,0.1)'; 
    }
}

function initInjectedStars(id) {
    const saved = localStorage.getItem(`rating_${id}`) || 0;
    const status = document.getElementById('inj-rating-status');
    if (status) status.innerHTML = saved > 0 ? `Оцінка: <span style="color: #ffd600;">${saved} з 5</span>` : "Натисніть для голосування";
    
    const starsContainer = document.getElementById('inj-stars-rating');
    if (starsContainer) {
        starsContainer.querySelectorAll('.star').forEach(star => { 
            const val = parseInt(star.getAttribute('data-value')); 
            star.textContent = val <= saved ? 'star' : 'star_border'; 
        });
    }
}

function checkInjectedSession() {
    const user = localStorage.getItem('peerplay_username');
    const nameInput = document.getElementById('inj-comment-name');
    const textInput = document.getElementById('inj-comment-text');
    const submitBtn = document.querySelector('#inj-comment-form .submit-comment-btn');
    
    if (!nameInput || !textInput || !submitBtn) return;

    if (user) {
        nameInput.value = user;
        textInput.disabled = false;
        submitBtn.disabled = false;
    } else {
        nameInput.value = "Гість";
        textInput.placeholder = "Авторизуйтесь для коментарів";
        textInput.disabled = true;
        submitBtn.disabled = true;
    }
}

async function loadInjectedComments(id) {
    const list = document.getElementById('inj-comments-list');
    if (!list) return;
    list.innerHTML = '<div style="color:#535763; font-style:italic">Завантаження...</div>';
    if (!galleryDb) return;
    try {
        const snapshot = await galleryDb.collection("comments").where("movieId", "==", id.toString()).get();
        list.innerHTML = '';
        if (snapshot.empty) { 
            list.innerHTML = '<p style="color: #535763; font-style: italic;">Будьте першим!</p>'; 
            return; 
        }

        let commentsArray = [];
        snapshot.forEach(doc => commentsArray.push(doc.data()));
        commentsArray.sort((a, b) => b.raw_date - a.raw_date);

        commentsArray.forEach(c => {
            const item = document.createElement('div'); 
            item.className = 'comment-item';
            item.innerHTML = `<div class="comment-meta" style="display: flex; justify-content: space-between; margin-bottom: 5px;"><span style="font-weight: 700; color: #ffd600;">${escapeInjHtml(c.name)}</span><span style="color: #535763; font-size: 12px;">${c.date}</span></div><p style="color: #b3b7c9; margin: 0;">${escapeInjHtml(c.text)}</p>`;
            list.appendChild(item);
        });
    } catch (err) {}
}

function escapeInjHtml(str) { 
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); 
}

function loadScriptSync(src) {
    return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = resolve;
        document.head.appendChild(s);
    });
}

async function ensureGalleryFirebase() {
    if (galleryFirebaseInit) return;
    try {
        if (typeof firebase === 'undefined') {
            await loadScriptSync('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
            await loadScriptSync('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
        }
        
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: "AIzaSyAwoesjgFsBUfpu1fVu3zrsDI4YvqcwBPo",
                authDomain: "peerplaytv.firebaseapp.com",
                projectId: "peerplaytv"
            });
        }
        galleryDb = firebase.firestore();
        galleryFirebaseInit = true;
    } catch (e) {}
}
