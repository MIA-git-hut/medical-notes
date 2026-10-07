/** Editorial navigation only; no astronomical or medical correspondence is asserted. */
export interface ReadingDestination {
  id: string
  title: string
  href: string
  description: string
}
export interface MansionNavigationCatalog {
  version: number
  relation: string
  description: string
  resources: ReadingDestination[]
  mansions: { name: string; resourceIds: string[] }[]
}

/** A future CMS/API adapter can implement this without changing star-chart geometry. */
export interface MansionNavigationProvider {
  load(): Promise<MansionNavigationCatalog>
}

export function resolveMansionReadings(catalog: MansionNavigationCatalog, name: string): ReadingDestination[] {
  const ids = catalog.mansions.find(mansion => mansion.name === name)?.resourceIds ?? []
  return ids.map(id => catalog.resources.find(resource => resource.id === id)).filter((resource): resource is ReadingDestination => !!resource)
}
