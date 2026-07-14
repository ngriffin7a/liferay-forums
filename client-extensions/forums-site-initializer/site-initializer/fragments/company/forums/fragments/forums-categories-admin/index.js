// SPDX-License-Identifier: LGPL-2.1-or-later
var forumsCategoriesAdmin = fragmentElement.querySelector('#forumsCategoriesAdmin');

if (forumsCategoriesAdmin) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var clayIconsUrl = Liferay.ThemeDisplay.getPathThemeImages() + '/clay/icons.svg';
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	/* FK field exposed by the ForumCategory self-relationship (0 = top-level) */
	var PARENT_FK = 'r_categorySubcategories_c_forumCategoryId';

	var cardEl = forumsCategoriesAdmin.querySelector('.forums-categories-admin__card');
	var noPermissionsEl = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminNoPermissions');
	var seedSection = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminSeedSection');
	var seedBtn = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminSeedBtn');
	var seedStatus = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminSeedStatus');
	var addHeading = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminAddHeading');
	var addForm = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminAddForm');
	var addName = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCatName');
	var addDesc = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCatDesc');
	var addParent = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCatParent');
	var addBtn = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminAddBtn');
	var listEl = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCategoryList');
	var loadingEl = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminLoading');

	/* Track whether the current user has create permission */
	var canCreate = false;

	var topLevelLabel = forumsCategoriesAdmin.dataset.labelTopLevel || 'None (top-level)';

	var defaultCategories = [
		{ name: configuration.category1Name, desc: configuration.category1Desc, erc: configuration.category1ERC },
		{ name: configuration.category2Name, desc: configuration.category2Desc, erc: configuration.category2ERC },
		{ name: configuration.category3Name, desc: configuration.category3Desc, erc: configuration.category3ERC },
		{ name: configuration.category4Name, desc: configuration.category4Desc, erc: configuration.category4ERC },
		{ name: configuration.category5Name, desc: configuration.category5Desc, erc: configuration.category5ERC }
	].filter(function(cat) { return cat.name; });

	/* --- Tree helpers ---------------------------------------------------- */

	function getParentId(cat) {
		return Number(cat[PARENT_FK]) || 0;
	}

	/* Map of parentId -> ordered array of child categories */
	function buildChildrenMap(items) {
		var byId = {};
		items.forEach(function(cat) { byId[cat.id] = cat; });

		var childrenOf = {};
		items.forEach(function(cat) {
			var parentId = getParentId(cat);
			/* Treat categories whose parent is missing as top-level (defensive) */
			if (parentId && !byId[parentId]) parentId = 0;
			(childrenOf[parentId] = childrenOf[parentId] || []).push(cat);
		});
		return childrenOf;
	}

	/* All descendant ids of a category (to forbid re-parenting into a cycle) */
	function getDescendantIds(id, childrenOf) {
		var ids = [];
		(function walk(parentId) {
			(childrenOf[parentId] || []).forEach(function(child) {
				ids.push(child.id);
				walk(child.id);
			});
		})(id);
		return ids;
	}

	/* Fill a <select> with an indented category tree, skipping excludeIds */
	function populateParentSelect(selectEl, childrenOf, selectedId, excludeIds) {
		excludeIds = excludeIds || [];
		selectEl.innerHTML = '';

		var topOption = document.createElement('option');
		topOption.value = '';
		topOption.textContent = topLevelLabel;
		selectEl.appendChild(topOption);

		(function walk(parentId, depth) {
			(childrenOf[parentId] || []).forEach(function(cat) {
				if (excludeIds.indexOf(cat.id) === -1) {
					var opt = document.createElement('option');
					opt.value = cat.id;
					var prefix = depth > 0 ? Array(depth + 1).join('— ') : '';
					opt.textContent = prefix + (cat.categoryName || forumsCategoriesAdmin.dataset.labelUnnamed || 'Unnamed');
					if (String(cat.id) === String(selectedId)) opt.selected = true;
					selectEl.appendChild(opt);
				}
				walk(cat.id, depth + 1);
			});
		})(0, 0);
	}

	/* --- Data access ----------------------------------------------------- */

	function loadCategories() {
		if (loadingEl) loadingEl.style.display = 'block';
		listEl.innerHTML = '';

		Liferay.Util.fetch(portalURL + '/o/c/forumcategories/scopes/' + scopeGroupId + '?pageSize=100&sort=categoryName:asc', {
			headers: headers,
			method: 'GET'
		})
		.then(function(r) { return r.json(); })
		.then(function(data) {
			if (loadingEl) loadingEl.style.display = 'none';

			/* HATEOAS: check collection-level actions for create permission */
			canCreate = !!(data.actions && (data.actions['create'] || data.actions['post'] || data.actions['POST']));

			if (canCreate) {
				/* User has admin-level permissions — show the admin card */
				if (noPermissionsEl) noPermissionsEl.style.display = 'none';
				if (cardEl) cardEl.style.display = '';
				if (seedSection) seedSection.style.display = '';
				if (addHeading) addHeading.style.display = '';
				if (addForm) addForm.style.display = '';
			} else {
				/* Non-privileged user — show the OOTB permissions warning */
				if (cardEl) cardEl.style.display = 'none';
				if (noPermissionsEl) noPermissionsEl.style.display = '';
				return;
			}

			var items = data.items || [];

			var childrenOf = buildChildrenMap(items);

			/* Refresh the add-form parent picker with the current tree */
			if (addParent) populateParentSelect(addParent, childrenOf, '', []);

			if (items.length === 0) {
				listEl.innerHTML = '<li class="list-group-item text-secondary">' + (forumsCategoriesAdmin.dataset.labelNoCategories || 'No categories found.') + '</li>';
				return;
			}

			/* Render the tree depth-first so subcategories sit under their parent */
			(function renderLevel(parentId, depth) {
				(childrenOf[parentId] || []).forEach(function(cat) {
					listEl.appendChild(renderCategoryItem(cat, depth, childrenOf));
					renderLevel(cat.id, depth + 1);
				});
			})(0, 0);
		})
		.catch(function(err) {
			if (loadingEl) loadingEl.style.display = 'none';

			/* On error (e.g. 403), show the permissions warning */
			if (cardEl) cardEl.style.display = 'none';
			if (noPermissionsEl) noPermissionsEl.style.display = '';
			console.error(err);
		});
	}

	/* Build a single list row (with inline edit form) for one category */
	function renderCategoryItem(cat, depth, childrenOf) {
		var li = document.createElement('li');
		li.className = 'list-group-item flex-column align-items-start';
		if (depth > 0) li.style.marginLeft = (depth * 1.5) + 'rem';

		var viewContainer = document.createElement('div');
		viewContainer.className = 'd-flex justify-content-between align-items-center w-100';

		var infoDiv = document.createElement('div');
		infoDiv.className = 'd-flex flex-column flex-grow-1';

		var nameSpan = document.createElement('span');
		nameSpan.className = 'font-weight-bold';
		nameSpan.textContent = cat.categoryName || forumsCategoriesAdmin.dataset.labelUnnamed || 'Unnamed';

		var descSpan = document.createElement('span');
		descSpan.className = 'text-secondary small';
		descSpan.textContent = cat.categoryDescription || '';

		infoDiv.appendChild(nameSpan);
		if (cat.categoryDescription) infoDiv.appendChild(descSpan);

		viewContainer.appendChild(infoDiv);

		var actionsDiv = document.createElement('div');
		actionsDiv.className = 'd-flex';

		/* HATEOAS: only render edit button if the item-level actions include 'update' */
		var updateAction = cat.actions && (cat.actions['update'] || cat.actions['patch'] || cat.actions['put'] || cat.actions['PATCH'] || cat.actions['PUT']);
		var editBtn = null;
		if (updateAction) {
			editBtn = document.createElement('button');
			editBtn.className = 'btn btn-sm btn-outline-secondary mr-2';
			editBtn.title = forumsCategoriesAdmin.dataset.labelEdit || 'Edit';
			editBtn.ariaLabel = forumsCategoriesAdmin.dataset.labelEdit || 'Edit';
			editBtn.setAttribute('data-tooltip-align', 'top');
			editBtn.innerHTML = '<svg class="lexicon-icon lexicon-icon-pencil" role="presentation"><use href="' + clayIconsUrl + '#pencil"></use></svg>';
			actionsDiv.appendChild(editBtn);
		}

		/* HATEOAS: only render delete button if the item-level actions include 'delete' */
		if (cat.actions && cat.actions['delete']) {
			var delBtn = document.createElement('button');
			delBtn.className = 'btn btn-sm btn-outline-danger';
			delBtn.title = forumsCategoriesAdmin.dataset.labelDelete || 'Delete';
			delBtn.ariaLabel = forumsCategoriesAdmin.dataset.labelDelete || 'Delete';
			delBtn.setAttribute('data-tooltip-align', 'top');
			delBtn.innerHTML = '<svg class="lexicon-icon lexicon-icon-trash" role="presentation"><use href="' + clayIconsUrl + '#trash"></use></svg>';
			delBtn.addEventListener('click', function() {
				deleteCategory(cat.actions['delete'].href, cat.id);
			});
			actionsDiv.appendChild(delBtn);
		}

		viewContainer.appendChild(actionsDiv);
		li.appendChild(viewContainer);

		if (updateAction && editBtn) {
			var editContainer = document.createElement('div');
			editContainer.className = 'w-100 mt-3';
			editContainer.style.display = 'none';

			var editForm = document.createElement('form');
			editForm.className = 'mb-0';
			var nameFieldId = 'forumsCatEditName-' + cat.id;
			var descFieldId = 'forumsCatEditDesc-' + cat.id;
			var parentFieldId = 'forumsCatEditParent-' + cat.id;
			var labelName = forumsCategoriesAdmin.dataset.labelCategoryName || 'Category Name';
			var labelDesc = forumsCategoriesAdmin.dataset.labelDescription || 'Description';
			var labelParent = forumsCategoriesAdmin.dataset.labelParentCategory || 'Parent Category';
			editForm.innerHTML = '<div class="row align-items-end">' +
				'<div class="col-12 col-md">' +
					'<div class="form-group mb-3 mb-md-0">' +
						'<label for="' + nameFieldId + '" class="sr-only">' + labelName + '</label>' +
						'<input type="text" class="form-control" id="' + nameFieldId + '" aria-label="' + labelName + '" required>' +
					'</div>' +
				'</div>' +
				'<div class="col-12 col-md">' +
					'<div class="form-group mb-3 mb-md-0">' +
						'<label for="' + descFieldId + '" class="sr-only">' + labelDesc + '</label>' +
						'<input type="text" class="form-control" id="' + descFieldId + '" aria-label="' + labelDesc + '">' +
					'</div>' +
				'</div>' +
				'<div class="col-12 col-md">' +
					'<div class="form-group mb-3 mb-md-0">' +
						'<label for="' + parentFieldId + '" class="sr-only">' + labelParent + '</label>' +
						'<select class="form-control" id="' + parentFieldId + '" aria-label="' + labelParent + '"></select>' +
					'</div>' +
				'</div>' +
				'<div class="col-12 col-md-auto mt-3 mt-md-0">' +
					'<button type="submit" class="btn btn-primary mr-2">' + (forumsCategoriesAdmin.dataset.labelSave || 'Save') + '</button>' +
					'<button type="button" class="btn btn-outline-secondary cancel-edit-btn">' + (forumsCategoriesAdmin.dataset.labelCancel || 'Cancel') + '</button>' +
				'</div>' +
			'</div>';

			var nameInput = editForm.querySelector('#' + nameFieldId);
			var descInput = editForm.querySelector('#' + descFieldId);
			var parentSelect = editForm.querySelector('#' + parentFieldId);
			var cancelBtn = editForm.querySelector('.cancel-edit-btn');
			var saveBtn = editForm.querySelector('button[type="submit"]');

			/* A category cannot be its own parent or a child of its descendants */
			var excludeIds = [cat.id].concat(getDescendantIds(cat.id, childrenOf));

			editBtn.addEventListener('click', function() {
				nameInput.value = cat.categoryName || '';
				descInput.value = cat.categoryDescription || '';
				populateParentSelect(parentSelect, childrenOf, getParentId(cat) || '', excludeIds);
				viewContainer.style.display = 'none';
				editContainer.style.display = 'block';
			});

			cancelBtn.addEventListener('click', function() {
				editContainer.style.display = 'none';
				viewContainer.style.display = 'flex';
			});

			editForm.addEventListener('submit', function(e) {
				e.preventDefault();
				var newName = nameInput.value.trim();
				var newDesc = descInput.value.trim();
				var newParent = parentSelect.value;
				if (!newName) return;

				saveBtn.disabled = true;
				cancelBtn.disabled = true;

				updateCategory(updateAction.href, cat.id, newName, newDesc, newParent)
					.then(function() {
						/* Reload so the tree reflects any re-parenting */
						loadCategories();
					})
					.catch(function(err) {
						console.error(err);
						alert(forumsCategoriesAdmin.dataset.labelErrorUpdating || 'Error updating category.');
						saveBtn.disabled = false;
						cancelBtn.disabled = false;
					});
			});

			editContainer.appendChild(editForm);
			li.appendChild(editContainer);
		}

		return li;
	}

	function createCategory(name, desc, erc, parentId) {
		var body = {
			categoryName: name,
			categoryName_i18n: { en_US: name },
			categoryDescription: desc || ''
		};
		if (erc) body.externalReferenceCode = erc;
		if (parentId) body[PARENT_FK] = parseInt(parentId, 10);

		return Liferay.Util.fetch(portalURL + '/o/c/forumcategories/scopes/' + scopeGroupId, {
			headers: headers,
			method: 'POST',
			body: JSON.stringify(body)
		}).then(function(r) {
			if (!r.ok) throw new Error('Create failed');
			return r.json();
		});
	}

	function updateCategory(updateUrl, id, name, desc, parentId) {
		var url = updateUrl || (portalURL + '/o/c/forumcategories/' + id);

		var body = {
			categoryName: name,
			categoryName_i18n: { en_US: name },
			categoryDescription: desc || ''
		};
		/* 0 unsets the relationship (promotes the category back to top-level) */
		body[PARENT_FK] = parentId ? parseInt(parentId, 10) : 0;

		return Liferay.Util.fetch(url, {
			headers: headers,
			method: 'PATCH',
			body: JSON.stringify(body)
		}).then(function(r) {
			if (!r.ok) throw new Error('Update failed');
			return r.json();
		});
	}

	function showConfirmModal(message, confirmLabel, onConfirm) {
		var existing = document.getElementById('forumsCatAdminConfirmModal');
		if (existing) existing.remove();

		var modal = document.createElement('div');
		modal.id = 'forumsCatAdminConfirmModal';
		modal.className = 'modal';
		modal.style.display = 'flex';
		modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
		modal.style.zIndex = '1050';
		modal.setAttribute('tabindex', '-1');
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');
		modal.setAttribute('aria-labelledby', 'forumsCatAdminConfirmHeading');

		modal.innerHTML = `
			<div class="modal-dialog modal-dialog-sm modal-dialog-centered modal-danger">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title" tabindex="-1">
							<div class="modal-title-indicator">
								<svg class="lexicon-icon lexicon-icon-exclamation-full" role="presentation"><use href="${clayIconsUrl}#exclamation-full"></use></svg>
							</div>
							<span id="forumsCatAdminConfirmHeading">${Liferay.Util.escapeHTML(confirmLabel)}</span>
						</h1>
						<button class="close btn btn-unstyled" type="button" id="forumsCatAdminConfirmClose" aria-label="${Liferay.Util.escapeHTML(forumsCategoriesAdmin.dataset.labelCancel || 'Cancel')}">
							<svg class="lexicon-icon lexicon-icon-times" focusable="false" role="presentation"><use href="${clayIconsUrl}#times"></use></svg>
						</button>
					</div>
					<div class="modal-body">
						<div class="liferay-modal-body">${Liferay.Util.escapeHTML(message)}</div>
					</div>
					<div class="modal-footer">
						<div class="modal-item-last">
							<div class="btn-group-spaced" role="group">
								<button class="btn btn-secondary" type="button" id="forumsCatAdminConfirmCancel">${Liferay.Util.escapeHTML(forumsCategoriesAdmin.dataset.labelCancel || 'Cancel')}</button>
								<button class="btn btn-danger" type="button" id="forumsCatAdminConfirmOk">${Liferay.Util.escapeHTML(confirmLabel)}</button>
							</div>
						</div>
					</div>
				</div>
			</div>`;

		document.body.appendChild(modal);
		var previousFocus = document.activeElement;

		function onKeydown(e) {
			if (e.key === 'Escape') closeModal();
		}

		function closeModal() {
			document.removeEventListener('keydown', onKeydown);
			modal.remove();
			if (previousFocus) previousFocus.focus();
		}

		modal.querySelector('#forumsCatAdminConfirmCancel').addEventListener('click', closeModal);
		modal.querySelector('#forumsCatAdminConfirmClose').addEventListener('click', closeModal);
		modal.querySelector('#forumsCatAdminConfirmOk').addEventListener('click', function() {
			closeModal();
			onConfirm();
		});
		modal.addEventListener('click', function(e) {
			if (e.target === modal) closeModal();
		});
		document.addEventListener('keydown', onKeydown);

		modal.querySelector('.modal-title').focus();
	}

	function deleteCategory(deleteUrl, id) {
		var message = forumsCategoriesAdmin.dataset.labelConfirmDelete || 'Are you sure you want to delete this category?';
		var confirmLabel = forumsCategoriesAdmin.dataset.labelDelete || 'Delete';
		showConfirmModal(message, confirmLabel, function() {
			var url = deleteUrl || (portalURL + '/o/c/forumcategories/' + id);
			Liferay.Util.fetch(url, {
				headers: headers,
				method: 'DELETE'
			})
			.then(function(r) {
				if (r.ok) loadCategories();
				else alert(forumsCategoriesAdmin.dataset.labelFailedDelete || 'Failed to delete category.');
			})
			.catch(function(err) {
				console.error(err);
				alert(forumsCategoriesAdmin.dataset.labelErrorDelete || 'Error deleting category.');
			});
		});
	}

	if (seedBtn) {
		seedBtn.addEventListener('click', function() {
			seedBtn.disabled = true;
			seedBtn.textContent = forumsCategoriesAdmin.dataset.labelSeeding || 'Seeding...';

			var promises = defaultCategories.map(function(cat) {
				return createCategory(cat.name, cat.desc, cat.erc).catch(function(e) { console.error(e); });
			});

			Promise.all(promises).then(function() {
				seedBtn.disabled = false;
				seedBtn.textContent = forumsCategoriesAdmin.dataset.labelSeedDefault || 'Seed Default Categories';
				if (seedStatus) {
					seedStatus.style.display = 'inline';
					setTimeout(function() { seedStatus.style.display = 'none'; }, 3000);
				}
				loadCategories();
			});
		});
	}

	if (addForm) {
		addForm.addEventListener('submit', function(e) {
			e.preventDefault();
			var name = addName.value.trim();
			var desc = addDesc.value.trim();
			var parentId = addParent ? addParent.value : '';

			if (!name) return;

			addBtn.disabled = true;
			createCategory(name, desc, null, parentId)
			.then(function() {
				addName.value = '';
				addDesc.value = '';
				if (addParent) addParent.value = '';
				addBtn.disabled = false;
				loadCategories();
			})
			.catch(function(err) {
				console.error(err);
				alert(forumsCategoriesAdmin.dataset.labelErrorCreating || 'Error creating category.');
				addBtn.disabled = false;
			});
		});
	}

	loadCategories();
}
