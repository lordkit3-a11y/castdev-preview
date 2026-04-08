# Кастдев — превью для GitHub Pages

Статический сайт: один файл `index.html` (копия отчёта по созвону).

## После первого push

1. На GitHub: **Settings → Pages**
2. **Source:** Deploy from a branch → **main** → **/ (root)** → Save
3. Ссылка будет: `https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПО/`

## Обновление

Правите `index.html` в Cursor (или копируйте сюда из `кастдев_Роман_превью.html`), затем:

```bash
cd castdev-public
git add index.html
git commit -m "Обновление"
git push
```
