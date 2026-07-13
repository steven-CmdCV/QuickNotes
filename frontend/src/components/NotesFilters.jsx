function NotesFilters({
  categoryOptions,
  disabled,
  hasActiveFilters,
  onCategoryChange,
  onClear,
  onOnlyFavoritesChange,
  onSearchChange,
  onlyFavorites,
  searchText,
  selectedCategory,
}) {
  return (
    <fieldset className="notes-filters">
      <legend>Filtrar notas</legend>
      <div className="notes-filters-grid">
        <div className="notes-filter-field">
          <label htmlFor="notes-search">Buscar notas</label>
          <input
            id="notes-search"
            type="search"
            placeholder="Buscar por título o contenido"
            disabled={disabled}
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="notes-filter-field">
          <label htmlFor="notes-category-filter">Categoría</label>
          <select
            id="notes-category-filter"
            disabled={disabled}
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="all">Todas las categorías</option>
            <option value="uncategorized">Sin categoría</option>
            {categoryOptions.map((category) => (
              <option
                key={category.id}
                value={`category:${category.id}`}
              >
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <label
          className="notes-filter-favorite"
          htmlFor="notes-favorites-filter"
        >
          <input
            id="notes-favorites-filter"
            type="checkbox"
            disabled={disabled}
            checked={onlyFavorites}
            onChange={(event) => onOnlyFavoritesChange(event.target.checked)}
          />
          Solo favoritas
        </label>

        <button
          className="clear-filters-button"
          type="button"
          disabled={disabled || !hasActiveFilters}
          onClick={onClear}
        >
          Limpiar filtros
        </button>
      </div>
    </fieldset>
  );
}

export default NotesFilters;
