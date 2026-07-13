document.addEventListener("DOMContentLoaded", function () {
    const galleryContainer = document.getElementById("actor-media");
    if (!galleryContainer) return;

    const actorId = galleryContainer.getAttribute("data-tmdb-id");
    const apiKey = "d81559e3ee0e79ee39f56758f4897fff"; 

    // 📡 Запитуємо ОДНОЧАСНО і картинки (images), і соцмережі (external_ids)
    const url = `https://api.themoviedb.org/3/person/${actorId}?api_key=${apiKey}&append_to_response=images,external_ids`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            // ==========================================
            // 🌟 1. БЛОК СОЦМЕРЕЖ (Динамічна ін'єкція)
            // ==========================================
            const extIds = data.external_ids;
            if (extIds) {
                const socials = [];
                
                if (extIds.instagram_id) socials.push({ name: "Instagram", url: `https://instagram.com/${extIds.instagram_id}`, icon: "photo_camera", color: "#E1306C" });
                if (extIds.twitter_id) socials.push({ name: "X (Twitter)", url: `https://x.com/${extIds.twitter_id}`, icon: "alternate_email", color: "#1DA1F2" });
                if (extIds.facebook_id) socials.push({ name: "Facebook", url: `https://facebook.com/${extIds.facebook_id}`, icon: "facebook", color: "#1877F2" });
                if (extIds.imdb_id) socials.push({ name: "IMDb Профіль", url: `https://www.imdb.com/name/${extIds.imdb_id}`, icon: "star_rate", color: "#f5c518" });

                if (socials.length > 0) {
                    // Створюємо контейнер для кнопок соцмереж
                    const socialWrap = document.createElement("div");
                    socialWrap.className = "actor-socials-block";
                    socialWrap.style.cssText = "display: flex; gap: 12px; margin: -15px 0 30px 0; flex-wrap: wrap;";

                    socials.forEach(net => {
                        const link = document.createElement("a");
                        link.href = net.url;
                        link.target = "_blank";
                        link.style.cssText = `display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.2s;`;
                        
                        // Додаємо іконку з Google Material Icons (вони вже підключені на сайті)
                        link.innerHTML = `<span class="material-icons" style="font-size: 16px; color: ${net.color}">${net.icon}</span> ${net.name}`;
                        
                        link.onmouseenter = () => { link.style.background = "rgba(255,255,255,0.08)"; link.style.borderColor = net.color; };
                        link.onmouseleave = () => { link.style.background = "rgba(255,255,255,0.03)"; link.style.borderColor = "rgba(255,255,255,0.08)"; };
                        
                        socialWrap.appendChild(link);
                    });

                    // Шукаємо заголовок "Біографія" і вставляємо кнопки акуратно ПЕРЕД ним
                    const bioHeader = document.querySelector("h2");
                    if (bioHeader) {
                        bioHeader.parentNode.insertBefore(socialWrap, bioHeader);
                    }
                }
            }

            // ==========================================
            // 🖼️ 2. БЛОК ГАЛЕРЕЇ (Твоя логіка карток)
            // ==========================================
            if (data.images && data.images.profiles && data.images.profiles.length > 0) {
                const grid = document.createElement("div");
                grid.className = "gallery-grid";

                const photos = data.images.profiles.slice(0, 8);

                photos.forEach(photo => {
                    const img = document.createElement("img");
                    img.src = `https://image.tmdb.org/t/p/w300${photo.file_path}`;
                    img.alt = "Фото актора з бази PeerPlay TV";
                    img.style.width = "100%";
                    img.style.borderRadius = "8px";
                    img.style.transition = "transform 0.2s ease";
                    img.onmouseenter = () => img.style.transform = "scale(1.05)";
                    img.onmouseleave = () => img.style.transform = "scale(1.0)";
                    grid.appendChild(img);
                });

                galleryContainer.innerHTML = "";
                galleryContainer.appendChild(grid);
            } else {
                galleryContainer.innerHTML = "<p style='color: #888;'>Фотогалерея для цього актора тимчасово порожня.</p>";
            }
        })
        .catch(err => {
            console.error("Помилка завантаження даних актора з TMDB:", err);
            galleryContainer.innerHTML = "<p style='color: #ff3333;'>Не вдалося завантажити фотогалерею.</p>";
        });
});