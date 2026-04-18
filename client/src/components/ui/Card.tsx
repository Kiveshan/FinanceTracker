// LEARNING NOTE: This is a pure presentational component.
// It has no state, no API calls — it just takes children and renders them
// inside a styled container. Building small reusable UI primitives like this
// means your entire app has a consistent look with minimal effort.

interface CardProps {
  children: React.ReactNode
  className?: string
  // LEARNING NOTE: React.ReactNode means "anything React can render" —
  // a string, a number, JSX, an array of JSX. It's the correct type for
  // the children prop.
  // The ? on className means it's optional — you don't have to pass it.
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}>
      {children}
    </div>
  )
}
