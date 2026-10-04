import type { SVGProps } from "react"

// App mark: a Z knocked out of a rounded square. Drawn on a 16px grid with
// even coordinates so edges land on whole pixels at 16, 24 and 32 px.
// Monochrome via currentColor, so it follows the surrounding text colour.
// app/icon.svg is the same path for the favicon.
export function ZolaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M4 0h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4ZM4 4v2h5l-5 4v2h8v-2H7l5-4V4H4Z"
      />
    </svg>
  )
}
