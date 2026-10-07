import type { EntityData } from '../flow/model.js';

interface SidebarProps {
    entities: readonly EntityData[];
    sources: readonly string[];
    hiddenSources: ReadonlySet<string>;
    query: string;
    visibleCount: number;
    relationCount: number;
    inferredCount: number;
    showInferred: boolean;
    onToggleInferred(): void;
    onQueryChange(query: string): void;
    onToggleSource(source: string): void;
    onShowAll(): void;
    onHideAll(): void;
}

export function Sidebar(props: SidebarProps) {
    const { entities, sources, hiddenSources, query, visibleCount, relationCount } = props;

    return (
        <aside className="sidebar">
            <h1 className="sidebar__title">Zodiac</h1>
            <p className="sidebar__summary">
                {visibleCount} / {entities.length} schemas · {relationCount} relations
            </p>

            <input
                className="sidebar__search"
                type="search"
                placeholder="Search a schema…"
                value={query}
                onChange={(event) => props.onQueryChange(event.target.value)}
            />

            <div className="sidebar__section">
                <h2>Files</h2>
                <span className="sidebar__actions">
                    <button type="button" onClick={props.onShowAll}>
                        all
                    </button>
                    <button type="button" onClick={props.onHideAll}>
                        none
                    </button>
                </span>
            </div>
            <ul className="sidebar__files">
                {sources.map((source) => {
                    const count = entities.filter((entity) => entity.source === source).length;
                    return (
                        <li key={source}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={!hiddenSources.has(source)}
                                    onChange={() => props.onToggleSource(source)}
                                />
                                <span className="sidebar__file" title={source}>
                                    {source}
                                </span>
                                <span className="sidebar__count">{count}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>

            {props.inferredCount > 0 && (
                <label className="sidebar__toggle" title="Fields such as shopId are linked to the Shop schema">
                    <input type="checkbox" checked={props.showInferred} onChange={props.onToggleInferred} />
                    <span>Inferred relations (dashed)</span>
                    <span className="sidebar__count">{props.inferredCount}</span>
                </label>
            )}

            <p className="sidebar__hint">Click a schema to highlight its links. Drag to rearrange.</p>
        </aside>
    );
}
