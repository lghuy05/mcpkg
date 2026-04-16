# SKILL.md

## 🎯 Goal
All code must be:
- Clean
- Readable
- Maintainable
- Scalable

---

## 🧱 Core Principles

1. Clarity > cleverness
2. Readability > brevity
3. Simplicity > over-engineering
4. Explicit > implicit

---

## 📛 Naming Conventions

- Use meaningful names:
  - ❌ x, tmp, data
  - ✅ userBalance, transactionQueue

- Functions must describe actions:
  - getUser()
  - processPayment()

---

## 🧩 Function Design

- One function = one responsibility
- Max length: ~20–30 lines
- Avoid deep nesting (>3 levels)

---

## 🧠 Code Structure

- Separate concerns:
  - controller
  - service
  - repository

- Avoid mixing:
  - business logic
  - database logic
  - API logic

---

## ⚡ Performance Awareness

- Be aware of:
  - time complexity
  - memory usage

- Always ask:
  - "Can this scale?"

---

## 🔄 Error Handling

- Never ignore errors
- Always:
  - log meaningful messages
  - handle edge cases

---

## 🧪 Testing Mindset

- Think:
  - edge cases
  - invalid input
  - failure scenarios

---

## 💬 Comments

- Explain WHY, not WHAT

❌ Bad:
```js
// increment i
i++;
