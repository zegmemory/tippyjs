import { createGlobalStyle } from 'styled-components'
import { MEDIA } from '../components/Framework'

export default createGlobalStyle`
  html {
    box-sizing: border-box;
    height: 100%;
  }

  *,
  *::after,
  *::before {
    box-sizing: inherit;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    margin: 0;
    color: #515168;
    height: 100%;
    font-size: 16px;
    -webkit-tap-highlight-color: transparent;

    ${MEDIA.md} {
      font-size: 17px;
    }
  }

  :focus:not(.focus-visible) {
    outline: 0;
  }

  &::-moz-selection {
    background: #333;
    color: white;
  }
  &::selection {
    background: #333;
    color: white;
  }

  pre code::-moz-selection,
  pre span::-moz-selection {
    background-color: rgba(200, 210, 255, 0.25);
    color: inherit;
  }
  pre code::selection,
  pre span::selection {
    background-color: rgba(200, 210, 255, 0.25);
    color: inherit;
  }
  
  a {
    color: #0065d5;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  h1, 
  h2, 
  h3, 
  h4, 
  h5, 
  h6 {
    position: relative;
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;

    &:hover .link-icon {
      opacity: 1;
    }
  }

  h1 {
    font-size: 2.488rem;
    margin-top: 2.488rem;
  }

  h2 {
    font-size: 2rem;
    display: inline-block;
    color: inherit;
    text-shadow: -2px 2px 0px #ffffff, -4px 4px 0px #aeffce;
    color: #5b36df;
    padding: 10px 0;
    transition: color 0.3s;

    &::-moz-selection {
      text-shadow: none;
    }

    &::selection {
      text-shadow: none;
    }

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: calc(50% + 40px);
      margin-left: -25px;
      background: linear-gradient(90deg,#aefcf9,#f4ffdf);
      z-index: -1;
      transition: width 0.4s cubic-bezier(.23, 1, .32, 1);
      border-radius: 3px;
    }

    ${MEDIA.md} {
      font-size: 2.488rem;
    }
  }

  h3 {
    font-size: 1.728rem;
    margin-top: 2.5rem;
    padding-right: 30px;

    ${MEDIA.md} {
      font-size: 2.074rem;
    }

    .link-icon {
      top: -12px;
    }
  }

  h4 {
    font-size: 1.44rem;
    margin-top: 2.2rem;
    color: #666c80;

    .link-icon {
      top: -15px;
    }

    ${MEDIA.md} {
      font-size: 1.728rem;
    }
  }

  h5 {
    font-size: 1.44rem;
    color: #666c80;
  }

  .link-icon {
    display: inline-block;
    position: absolute;
    padding: 20px 0;
    box-sizing: content-box;
    background-repeat: no-repeat;
    background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItbGluayI+PHBhdGggZD0iTTEwIDEzYTUgNSAwIDAgMCA3LjU0LjU0bDMtM2E1IDUgMCAwIDAtNy4wNy03LjA3bC0xLjcyIDEuNzEiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTFhNSA1IDAgMCAwLTcuNTQtLjU0bC0zIDNhNSA1IDAgMCAwIDcuMDcgNy4wN2wxLjcxLTEuNzEiPjwvcGF0aD48L3N2Zz4=');
    background-position: left center;
    opacity: 0;
    transition: opacity 0.2s;
    width: 26px;
    height: 18px;
    background-size: 18px 18px;
    top: -15px;
    right: 0;

    &:hover,
    &:focus {
      opacity: 1;
    }

    ${MEDIA.md} {
      width: 25px;
      height: 20px;
      right: initial;
      background-size: 20px 20px;
      left: -25px;

      &:focus {
        width: 20px;
      }
    }
  }

  p, 
  li {
    line-height: 1.6;
    margin-top: 0.5rem;
  }

  ul {
    padding-left: 18px;
  }

  table {
    box-shadow: 0 0 0 1px rgba(0,32,128,0.1);
    border-collapse: collapse;
    margin: 0;
    padding: 0;
    line-height: 1.4;
    border-radius: 0 0 10px 10px;
    font-size: 16px;

    ${MEDIA.xl} {
      width: calc(100% + 50px);
      margin-left: -25px;
    }
  }

  table tr {
    padding: 5px;

    &:not(:last-child) {
      border-bottom: 1px dotted rgba(0,32,128,0.1);
    }
  }

  td:first-child code {
    background: none;
    font-size: 18px;
    color: #333;
    padding: 0;
  }

  th:last-child, td:last-child {
    padding-left: 25px;
  }

  table th, table td {
    text-align: left;
    padding: 15px;

    ${MEDIA.xl} {
      padding: 15px 25px;
    }
  }

  table th {
    position: relative;
    z-index: 1;
    font-size: 14px;
    text-transform: uppercase;
    background: #eeeefa;
    position: sticky;
    top: 0;
  }

  @media (max-width: 1150px) {
    table {
      border: 0;
      box-shadow: none;
    }

    table thead {
      display: none;
    }

    table tr {
      border: 1px solid rgba(0,32,128,0.1);
      display: block;
      margin-bottom: 10px;
      border-radius: 10px;
    }

    table td {
      display: block;

      &:not(:last-child) {
        border-bottom: 1px dotted rgba(0,32,128,0.1);
      }
    }

    table td:last-child {
      border-bottom: 0;
    }

    th:last-child, td:last-child {
      padding-left: 15px;
    }

    table td::before {
      content: attr(data-label);
      display: block;
      font-weight: bold;
      text-transform: uppercase;
      opacity: 0.7;
      font-size: 13px;
      margin-bottom: 5px;
    }

    td:first-child code {
      font-size: 100%;
    }
  }

  hr {
    border: none;
    border-top: 1px solid rgba(0, 16, 64, 0.15);
    margin-top: 5px;
  }

  [data-reach-skip-link] {
    position: fixed;
    z-index: 2;
    padding: 10px;
    left: -9999px;
    background: white;
    border-radius: 4px;
    font-weight: bold;
    font-size: 15px;

    &:focus {
      left: 5px;
      top: 5px;
    }
  }

  button,
  a {
    &.focus-visible {
      outline: 0;
      box-shadow: 0 0 0 2px rgb(255, 255, 255), 0 0 0 5px rgb(150, 180, 255);
    }
  }
`
