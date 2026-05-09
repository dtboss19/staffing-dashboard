# How to integrate Presentation into App.jsx

## 1. Add the import at the top of App.jsx (after the existing imports):
```js
import { Presentation } from './Presentation'
```

## 2. Add state inside the App() function (near the other useState declarations):
```js
const [presentationMode, setPresentationMode] = useState(false)
```

## 3. Add this block right after the opening <main className="dashboard"> tag:
```jsx
{presentationMode && (
  <Presentation
    onExit={() => setPresentationMode(false)}
    onSwitchTab={(tab) => { setActiveTab(tab); setPresentationMode(false) }}
  />
)}
```

## 4. Add a Present button inside the <section className="tabs"> block,
   after the last existing tab button:
```jsx
<button
  type="button"
  className="tab"
  onClick={() => setPresentationMode(true)}
  style={{ marginLeft: 'auto', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderColor: '#7c3aed', color: '#fff' }}
>
  ▶ Present
</button>
```
