package providers

import (
	"fmt"
)

// Registry manages all available providers and allows selecting one by name.
type Registry struct {
	providers map[string]Provider
}

// NewRegistry creates an empty provider registry.
func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
	}
}

// Register adds a provider to the registry. Panics if a provider with the
// same name is registered twice (intended as a startup-time safety check).
func (r *Registry) Register(p Provider) {
	name := p.Name()
	if _, exists := r.providers[name]; exists {
		panic(fmt.Sprintf("providers: duplicate registration for %q", name))
	}
	r.providers[name] = p
}

// Get retrieves a provider by name. Returns an error if not found.
func (r *Registry) Get(name string) (Provider, error) {
	p, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("providers: %q not found (available: %v)", name, r.Names())
	}
	return p, nil
}

// Names returns a sorted list of all registered provider names.
func (r *Registry) Names() []string {
	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}

// All returns all registered providers as a slice.
func (r *Registry) All() []Provider {
	all := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		all = append(all, p)
	}
	return all
}
