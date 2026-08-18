/*
 * Board Administration
 * ---------------------
 * Data contract with the backend:
 *
 *   GET /api/items  ->  200 OK
 *   {
 *     "sections": {
 *       "west":   { "title": "Weekday Schedule", "pages": [ Page, ... ] },
 *       "center": { "title": "Announcements",    "pages": [ Page, ... ] },
 *       "east":   { "title": "Shabbos Times",    "pages": [ Page, ... ] }
 *     }
 *   }
 *
 *   Page = { "id": string, "items": [ Item, ... ] }
 *
 *   Item (announcement) = { "id": string, "item_type": "announcement", "title": string, "text": string }
 *   Item (scheduled)     = { "id": string, "item_type": "scheduled",     "title": string, "time": "HH:MM" }
 *
 *   Saving sends the same shape back as the request body:
 *   PUT /api/items  (Content-Type: application/json)
 *
 *   Password change:
 *   POST /api/change-password  { "currentPassword": string, "newPassword": string }
 *
 * Each "page" corresponds to one carousel slide on the public board;
 * each "item" is one piece of content rendered on that slide.
 */

(function () {
	'use strict';

	var ITEMS_ENDPOINT = '/api/items';
	var PASSWORD_ENDPOINT = '/api/change-password';

	var SECTION_KEYS = ['west', 'center', 'east'];
	var SECTION_TITLES = {
		west: 'Weekday Schedule',
		center: 'Announcements',
		east: 'Shabbos Times'
	};

	var data = null;
	var dirty = false;

	// ---------- ids ----------

	function uid(prefix) {
		return prefix + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
	}

	// ---------- fallback sample data (used if the API is unreachable) ----------

	function defaultData() {
		return {
			sections: {
				west: {
					title: 'Weekday Schedule',
					pages: [
						{
							id: uid('page'),
							items: [
								{ id: uid('item'), item_type: 'scheduled', title: 'Shacharis', time: '06:30' },
								{ id: uid('item'), item_type: 'scheduled', title: 'Daf Yomi (Rov)', time: '07:25' },
								{ id: uid('item'), item_type: 'scheduled', title: 'Mincha / Maariv', time: '19:50' },
								{ id: uid('item'), item_type: 'scheduled', title: 'Additional Maariv', time: '22:00' }
							]
						}
					]
				},
				center: {
					title: 'Announcements',
					pages: [
						{
							id: uid('page'),
							items: [
								{
									id: uid('item'),
									item_type: 'announcement',
									title: 'Mazal Tov',
									text: 'To the Amoni family on the Bar Mitzva of their son, Ploni.'
								}
							]
						},
						{
							id: uid('page'),
							items: [
								{
									id: uid('item'),
									item_type: 'announcement',
									title: 'Kiddush Sponsor',
									text: "This Shabbos's Kiddush is sponsored by Ish Boshes."
								}
							]
						}
					]
				},
				east: {
					title: 'Shabbos Times',
					pages: [
						{
							id: uid('page'),
							items: [
								{ id: uid('item'), item_type: 'scheduled', title: 'Kabolas Shabbos', time: '19:00' },
								{ id: uid('item'), item_type: 'scheduled', title: 'Shacharis I', time: '07:00' },
								{ id: uid('item'), item_type: 'scheduled', title: 'Shacharis II', time: '08:45' }
							]
						}
					]
				}
			}
		};
	}

	// ---------- load / normalize ----------

	function normalize(json) {
		var base = defaultData();
		var out = { sections: {} };

		SECTION_KEYS.forEach(function (key) {
			var src = json && json.sections && json.sections[key];
			var pages = Array.isArray(src && src.pages)
				? src.pages.map(function (p) {
						return {
							id: p.id || uid('page'),
							items: Array.isArray(p.items)
								? p.items.map(function (it) {
										return {
											id: it.id || uid('item'),
											item_type: it.item_type === 'scheduled' ? 'scheduled' : 'announcement',
											title: it.title || '',
											text: it.text || '',
											time: it.time || ''
										};
									})
								: []
						};
					})
				: base.sections[key].pages;

			out.sections[key] = {
				title: (src && src.title) || SECTION_TITLES[key],
				pages: pages
			};
		});

		return out;
	}

	function loadData() {
		fetch(ITEMS_ENDPOINT)
			.then(function (res) {
				if (!res.ok) {
					throw new Error('Request failed: ' + res.status);
				}
				return res.json();
			})
			.then(function (json) {
				data = normalize(json);
				hideLoadError();
				renderAll();
			})
			.catch(function (err) {
				console.error('Failed to load ' + ITEMS_ENDPOINT, err);
				data = defaultData();
				showLoadError();
				renderAll();
			});
	}

	function showLoadError() {
		var box = document.getElementById('load-error');
		box.textContent =
			"Couldn't load data from " + ITEMS_ENDPOINT + ' — showing example content instead. ' +
			'Changes here won\u2019t persist until the API is reachable.';
		box.classList.remove('d-none');
	}

	function hideLoadError() {
		document.getElementById('load-error').classList.add('d-none');
	}

	// ---------- mutations ----------

	function findPage(sectionKey, pageId) {
		return data.sections[sectionKey].pages.find(function (p) {
			return p.id === pageId;
		});
	}

	function markDirty() {
		dirty = true;
		setSaveStatus('Unsaved changes');
	}

	function addPage(sectionKey) {
		data.sections[sectionKey].pages.push({ id: uid('page'), items: [] });
		renderSection(sectionKey);
		markDirty();
	}

	function removePage(sectionKey, pageId) {
		if (!window.confirm('Remove this page and all of its items?')) {
			return;
		}
		data.sections[sectionKey].pages = data.sections[sectionKey].pages.filter(function (p) {
			return p.id !== pageId;
		});
		renderSection(sectionKey);
		markDirty();
	}

	function movePage(sectionKey, pageId, dir) {
		var pages = data.sections[sectionKey].pages;
		var idx = pages.findIndex(function (p) {
			return p.id === pageId;
		});
		var newIdx = idx + dir;
		if (newIdx < 0 || newIdx >= pages.length) {
			return;
		}
		var tmp = pages[idx];
		pages[idx] = pages[newIdx];
		pages[newIdx] = tmp;
		renderSection(sectionKey);
		markDirty();
	}

	function addItem(sectionKey, pageId, type) {
		var page = findPage(sectionKey, pageId);
		var item =
			type === 'scheduled'
				? { id: uid('item'), item_type: 'scheduled', title: '', time: '' }
				: { id: uid('item'), item_type: 'announcement', title: '', text: '' };
		page.items.push(item);
		renderSection(sectionKey);
		markDirty();
	}

	function removeItem(sectionKey, pageId, itemId) {
		var page = findPage(sectionKey, pageId);
		page.items = page.items.filter(function (i) {
			return i.id !== itemId;
		});
		renderSection(sectionKey);
		markDirty();
	}

	function moveItem(sectionKey, pageId, itemId, dir) {
		var page = findPage(sectionKey, pageId);
		var idx = page.items.findIndex(function (i) {
			return i.id === itemId;
		});
		var newIdx = idx + dir;
		if (newIdx < 0 || newIdx >= page.items.length) {
			return;
		}
		var tmp = page.items[idx];
		page.items[idx] = page.items[newIdx];
		page.items[newIdx] = tmp;
		renderSection(sectionKey);
		markDirty();
	}

	function updateItemField(sectionKey, pageId, itemId, field, value) {
		var page = findPage(sectionKey, pageId);
		var item = page.items.find(function (i) {
			return i.id === itemId;
		});
		item[field] = value;
		markDirty();
		// Deliberately no re-render here: this fires on every keystroke,
		// and rebuilding the DOM would steal focus out of the field.
	}

	// ---------- rendering ----------

	function renderAll() {
		SECTION_KEYS.forEach(renderSection);
	}

	function renderSection(key) {
		var container = document.querySelector('.pages-list[data-section="' + key + '"]');
		container.innerHTML = '';

		var pages = data.sections[key].pages;

		if (pages.length === 0) {
			var hint = document.createElement('p');
			hint.className = 'empty-hint';
			hint.textContent = 'No pages yet — add one to create the first carousel slide.';
			container.appendChild(hint);
			return;
		}

		pages.forEach(function (page, idx) {
			container.appendChild(renderPage(key, page, idx, pages.length));
		});
	}

	function renderPage(sectionKey, page, idx, total) {
		var tpl = document.getElementById('page-template');
		var node = tpl.content.firstElementChild.cloneNode(true);

		node.querySelector('.page-label').textContent = 'Page ' + (idx + 1);

		var upBtn = node.querySelector('.move-page-up');
		var downBtn = node.querySelector('.move-page-down');
		upBtn.disabled = idx === 0;
		downBtn.disabled = idx === total - 1;
		upBtn.addEventListener('click', function () {
			movePage(sectionKey, page.id, -1);
		});
		downBtn.addEventListener('click', function () {
			movePage(sectionKey, page.id, 1);
		});
		node.querySelector('.remove-page').addEventListener('click', function () {
			removePage(sectionKey, page.id);
		});

		var itemsList = node.querySelector('.items-list');
		if (page.items.length === 0) {
			var hint = document.createElement('p');
			hint.className = 'empty-hint';
			hint.textContent = 'No items on this page yet.';
			itemsList.appendChild(hint);
		} else {
			page.items.forEach(function (item, itemIdx) {
				itemsList.appendChild(renderItem(sectionKey, page.id, item, itemIdx, page.items.length));
			});
		}

		node.querySelector('.add-announcement-item').addEventListener('click', function () {
			addItem(sectionKey, page.id, 'announcement');
		});
		node.querySelector('.add-scheduled-item').addEventListener('click', function () {
			addItem(sectionKey, page.id, 'scheduled');
		});

		return node;
	}

	function renderItem(sectionKey, pageId, item, idx, total) {
		var tplId = item.item_type === 'scheduled' ? 'item-scheduled-template' : 'item-announcement-template';
		var tpl = document.getElementById(tplId);
		var node = tpl.content.firstElementChild.cloneNode(true);

		var titleInput = node.querySelector('.item-title');
		titleInput.value = item.title;
		titleInput.addEventListener('input', function (e) {
			updateItemField(sectionKey, pageId, item.id, 'title', e.target.value);
		});

		if (item.item_type === 'scheduled') {
			var timeInput = node.querySelector('.item-time');
			timeInput.value = item.time || '';
			timeInput.addEventListener('input', function (e) {
				updateItemField(sectionKey, pageId, item.id, 'time', e.target.value);
			});
		} else {
			var textInput = node.querySelector('.item-text');
			textInput.value = item.text || '';
			textInput.addEventListener('input', function (e) {
				updateItemField(sectionKey, pageId, item.id, 'text', e.target.value);
			});
		}

		var upBtn = node.querySelector('.move-item-up');
		var downBtn = node.querySelector('.move-item-down');
		upBtn.disabled = idx === 0;
		downBtn.disabled = idx === total - 1;
		upBtn.addEventListener('click', function () {
			moveItem(sectionKey, pageId, item.id, -1);
		});
		downBtn.addEventListener('click', function () {
			moveItem(sectionKey, pageId, item.id, 1);
		});
		node.querySelector('.remove-item').addEventListener('click', function () {
			removeItem(sectionKey, pageId, item.id);
		});

		return node;
	}

	// ---------- save ----------

	function setSaveStatus(text) {
		document.getElementById('save-status').textContent = text;
	}

	function setSaving(isSaving) {
		var btn = document.getElementById('save-btn');
		btn.disabled = isSaving;
		btn.textContent = isSaving ? 'Saving\u2026' : 'Save';
	}

	function saveData() {
		setSaving(true);
		fetch(ITEMS_ENDPOINT, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		})
			.then(function (res) {
				if (!res.ok) {
					throw new Error('Save failed: ' + res.status);
				}
				dirty = false;
				setSaveStatus('Saved \u2713');
				setTimeout(function () {
					setSaveStatus('');
				}, 2500);
			})
			.catch(function (err) {
				console.error(err);
				setSaveStatus('Save failed — please try again');
			})
			.finally(function () {
				setSaving(false);
			});
	}

	// ---------- password modal ----------

	function initPasswordForm() {
		var form = document.getElementById('password-form');
		var errorBox = document.getElementById('password-error');
		var successBox = document.getElementById('password-success');
		var modalEl = document.getElementById('passwordModal');

		modalEl.addEventListener('hidden.bs.modal', function () {
			form.reset();
			errorBox.classList.add('d-none');
			successBox.classList.add('d-none');
		});

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			errorBox.classList.add('d-none');
			successBox.classList.add('d-none');

			var current = document.getElementById('current-password').value;
			var next = document.getElementById('new-password').value;
			var confirm = document.getElementById('confirm-password').value;

			if (next.length < 8) {
				errorBox.textContent = 'New password must be at least 8 characters.';
				errorBox.classList.remove('d-none');
				return;
			}
			if (next !== confirm) {
				errorBox.textContent = 'New password and confirmation do not match.';
				errorBox.classList.remove('d-none');
				return;
			}

			var submitBtn = form.querySelector('button[type="submit"]');
			submitBtn.disabled = true;

			fetch(PASSWORD_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword: current, newPassword: next })
			})
				.then(function (res) {
					if (!res.ok) {
						throw new Error('Request failed: ' + res.status);
					}
					successBox.textContent = 'Password updated successfully.';
					successBox.classList.remove('d-none');
					form.reset();
				})
				.catch(function (err) {
					console.error(err);
					errorBox.textContent = 'Could not update the password. Please try again.';
					errorBox.classList.remove('d-none');
				})
				.finally(function () {
					submitBtn.disabled = false;
				});
		});
	}

	// ---------- init ----------

	document.addEventListener('DOMContentLoaded', function () {
		document.querySelectorAll('.btn-add-page').forEach(function (btn) {
			btn.addEventListener('click', function () {
				addPage(btn.dataset.section);
			});
		});

		document.getElementById('save-btn').addEventListener('click', saveData);

		initPasswordForm();
		loadData();
	});

	window.addEventListener('beforeunload', function (e) {
		if (dirty) {
			e.preventDefault();
			e.returnValue = '';
		}
	});
})();
