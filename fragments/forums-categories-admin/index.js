var forumsCategoriesAdmin = fragmentElement.querySelector('#forumsCategoriesAdmin');

if (forumsCategoriesAdmin) {
	var portalURL = Liferay.ThemeDisplay.getPortalURL();
	var scopeGroupId = Liferay.ThemeDisplay.getScopeGroupId();
	var clayIconsUrl = Liferay.ThemeDisplay.getPathThemeImages() + '/clay/icons.svg';
	var headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};

	var cardEl = forumsCategoriesAdmin.querySelector('.forums-categories-admin__card');
	var noPermissionsEl = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminNoPermissions');
	var seedSection = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminSeedSection');
	var seedBtn = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminSeedBtn');
	var seedStatus = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminSeedStatus');
	var addHeading = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminAddHeading');
	var addForm = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminAddForm');
	var addName = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCatName');
	var addDesc = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCatDesc');
	var addBtn = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminAddBtn');
	var listEl = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminCategoryList');
	var loadingEl = forumsCategoriesAdmin.querySelector('#forumsCategoriesAdminLoading');

	/* Track whether the current user has create permission */
	var canCreate = false;

	var defaultCategories = [
		{ name: configuration.category1Name, desc: configuration.category1Desc, erc: configuration.category1ERC },
		{ name: configuration.category2Name, desc: configuration.category2Desc, erc: configuration.category2ERC },
		{ name: configuration.category3Name, desc: configuration.category3Desc, erc: configuration.category3ERC },
		{ name: configuration.category4Name, desc: configuration.category4Desc, erc: configuration.category4ERC },
		{ name: configuration.category5Name, desc: configuration.category5Desc, erc: configuration.category5ERC }
	].filter(function(cat) { return cat.name; });

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

			if (items.length === 0) {
				listEl.innerHTML = '<li class="list-group-item text-muted">' + (forumsCategoriesAdmin.dataset.labelNoCategories || 'No categories found.') + '</li>';
				return;
			}

			items.forEach(function(cat) {
				var li = document.createElement('li');
				li.className = 'list-group-item flex-column align-items-start';

				var viewContainer = document.createElement('div');
				viewContainer.className = 'd-flex justify-content-between align-items-center w-100';

				var infoDiv = document.createElement('div');
				infoDiv.className = 'forums-categories-admin__cat-info flex-grow-1';

				var nameSpan = document.createElement('span');
				nameSpan.className = 'forums-categories-admin__cat-name';
				nameSpan.textContent = cat.categoryName || forumsCategoriesAdmin.dataset.labelUnnamed || 'Unnamed';

				var descSpan = document.createElement('span');
				descSpan.className = 'forums-categories-admin__cat-desc';
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
					editBtn.innerHTML = '<svg class="lexicon-icon lexicon-icon-pencil" role="presentation"><use href="' + clayIconsUrl + '#pencil"></use></svg>';
					actionsDiv.appendChild(editBtn);
				}

				/* HATEOAS: only render delete button if the item-level actions include 'delete' */
				if (cat.actions && cat.actions['delete']) {
					var delBtn = document.createElement('button');
					delBtn.className = 'btn btn-sm btn-outline-danger';
					delBtn.title = forumsCategoriesAdmin.dataset.labelDelete || 'Delete';
					delBtn.ariaLabel = forumsCategoriesAdmin.dataset.labelDelete || 'Delete';
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
					var labelName = forumsCategoriesAdmin.dataset.labelCategoryName || 'Category Name';
					var labelDesc = forumsCategoriesAdmin.dataset.labelDescription || 'Description';
					editForm.innerHTML = '<div class="row align-items-end">' +
						'<div class="col-md-5">' +
							'<div class="form-group mb-md-0">' +
								'<label for="' + nameFieldId + '" class="sr-only">' + labelName + '</label>' +
								'<input type="text" class="form-control" id="' + nameFieldId + '" aria-label="' + labelName + '" required>' +
							'</div>' +
						'</div>' +
						'<div class="col-md-5">' +
							'<div class="form-group mb-md-0">' +
								'<label for="' + descFieldId + '" class="sr-only">' + labelDesc + '</label>' +
								'<input type="text" class="form-control" id="' + descFieldId + '" aria-label="' + labelDesc + '">' +
							'</div>' +
						'</div>' +
						'<div class="col-md-2">' +
							'<button type="submit" class="btn btn-sm btn-primary w-100 mb-1">' + (forumsCategoriesAdmin.dataset.labelSave || 'Save') + '</button>' +
							'<button type="button" class="btn btn-sm btn-outline-secondary w-100 cancel-edit-btn">' + (forumsCategoriesAdmin.dataset.labelCancel || 'Cancel') + '</button>' +
						'</div>' +
					'</div>';

					var inputs = editForm.querySelectorAll('input');
					var nameInput = inputs[0];
					var descInput = inputs[1];
					var cancelBtn = editForm.querySelector('.cancel-edit-btn');
					var saveBtn = editForm.querySelector('button[type="submit"]');

					editBtn.addEventListener('click', function() {
						nameInput.value = cat.categoryName || '';
						descInput.value = cat.categoryDescription || '';
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
						if (!newName) return;

						saveBtn.disabled = true;
						cancelBtn.disabled = true;

						updateCategory(updateAction.href, cat.id, newName, newDesc)
							.then(function(updatedCat) {
								cat = updatedCat;
								nameSpan.textContent = cat.categoryName || forumsCategoriesAdmin.dataset.labelUnnamed || 'Unnamed';
								descSpan.textContent = cat.categoryDescription || '';
								if (cat.categoryDescription && !descSpan.parentNode) {
									infoDiv.appendChild(descSpan);
								} else if (!cat.categoryDescription && descSpan.parentNode) {
									infoDiv.removeChild(descSpan);
								}
								saveBtn.disabled = false;
								cancelBtn.disabled = false;
								editContainer.style.display = 'none';
								viewContainer.style.display = 'flex';
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

				listEl.appendChild(li);
			});
		})
		.catch(function(err) {
			if (loadingEl) loadingEl.style.display = 'none';

			/* On error (e.g. 403), show the permissions warning */
			if (cardEl) cardEl.style.display = 'none';
			if (noPermissionsEl) noPermissionsEl.style.display = '';
			console.error(err);
		});
	}

	function createCategory(name, desc, erc) {
		var body = {
			categoryName: name,
			categoryName_i18n: { en_US: name },
			categoryDescription: desc || ''
		};
		if (erc) body.externalReferenceCode = erc;

		return Liferay.Util.fetch(portalURL + '/o/c/forumcategories/scopes/' + scopeGroupId, {
			headers: headers,
			method: 'POST',
			body: JSON.stringify(body)
		}).then(function(r) {
			if (!r.ok) throw new Error('Create failed');
			return r.json();
		});
	}

	function updateCategory(updateUrl, id, name, desc) {
		var url = updateUrl || (portalURL + '/o/c/forumcategories/' + id);

		return Liferay.Util.fetch(url, {
			headers: headers,
			method: 'PATCH',
			body: JSON.stringify({
				categoryName: name,
				categoryName_i18n: { en_US: name },
				categoryDescription: desc || ''
			})
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
			<div class="modal-dialog modal-dialog-sm modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title" id="forumsCatAdminConfirmHeading" tabindex="-1">${Liferay.Util.escapeHTML(message)}</h1>
					</div>
					<div class="modal-footer">
						<div class="btn-group-spaced" role="group">
							<button class="btn btn-secondary" type="button" id="forumsCatAdminConfirmCancel">${Liferay.Util.escapeHTML(forumsCategoriesAdmin.dataset.labelCancel || 'Cancel')}</button>
							<button class="btn btn-danger" type="button" id="forumsCatAdminConfirmOk">${Liferay.Util.escapeHTML(confirmLabel)}</button>
						</div>
					</div>
				</div>
			</div>`;

		document.body.appendChild(modal);
		var previousFocus = document.activeElement;

		function closeModal() {
			modal.remove();
			if (previousFocus) previousFocus.focus();
		}

		modal.querySelector('#forumsCatAdminConfirmCancel').addEventListener('click', closeModal);
		modal.querySelector('#forumsCatAdminConfirmOk').addEventListener('click', function() {
			closeModal();
			onConfirm();
		});
		modal.addEventListener('keydown', function(e) {
			if (e.key === 'Escape') closeModal();
		});

		modal.querySelector('#forumsCatAdminConfirmHeading').focus();
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

			if (!name) return;

			addBtn.disabled = true;
			createCategory(name, desc)
			.then(function() {
				addName.value = '';
				addDesc.value = '';
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
