# Survey Platform

## Production CRM address

The production CRM is built into the Hostinger website at `https://www.hinrichsspecialtyservices.com/crm/`. Public navigation points to `/crm/login`, keeping the website and admin interface on one visible domain. Firebase Hosting remains an API origin for Cloud Functions and is not the public CRM destination.

A generic, extensible survey platform that allows you to create and manage multiple surveys. Built with Node.js/Express backend and vanilla JavaScript frontend.

## Features

- **Multiple Surveys**: Host multiple surveys on a single platform
- **JSON-Based Survey Definitions**: Easy to create and modify surveys using JSON
- **Dynamic Form Rendering**: Automatically renders forms based on survey JSON structure
- **Response Storage**: Stores all responses in JSON files
- **Export Functionality**: Export survey responses as downloadable JSON
- **Clean, Responsive UI**: Professional design that works on all devices
- **Extensible**: Easy to add new surveys by dropping JSON files into the `surveys/` folder

## Quick Start

### Install Dependencies

```bash
npm install
```

### Start the Server

```bash
npm start
```

The survey platform will be available at `http://localhost:3000`

## Project Structure

```
survey-platform/
├── server/
│   └── server.js          # Express backend API
├── public/
│   ├── index.html         # Main HTML page
│   ├── styles.css         # Stylesheet
│   └── app.js             # Frontend JavaScript
├── surveys/
│   └── fillmore-powerlifting.json  # Survey definitions
├── responses/
│   └── *.json             # Survey responses (auto-generated)
├── package.json
└── README.md
```

## Creating a New Survey

1. Create a new JSON file in the `surveys/` folder (e.g., `my-survey.json`)
2. Use the following structure:

```json
{
  "id": "my-survey",
  "title": "My Survey Title",
  "description": "Description of what this survey is for",
  "active": true,
  "createdAt": "2026-03-14T00:00:00Z",
  "questions": [
    {
      "id": "questionId",
      "type": "text",
      "label": "Question Label",
      "required": true
    }
  ]
}
```

### Question Types

| Type       | Description                  | Options                             |
| ---------- | ---------------------------- | ----------------------------------- |
| `text`     | Single-line text input       | -                                   |
| `email`    | Email input with validation  | -                                   |
| `number`   | Numeric input                | -                                   |
| `textarea` | Multi-line text input        | -                                   |
| `radio`    | Single choice from options   | `options: ["Option 1", "Option 2"]` |
| `checkbox` | Multiple choice from options | `options: ["Option 1", "Option 2"]` |

### Example Question

```json
{
  "id": "feedback",
  "type": "radio",
  "label": "How satisfied are you?",
  "options": ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"],
  "required": true
}
```

## API Endpoints

### Get All Surveys

```
GET /api/surveys
```

### Get Single Survey

```
GET /api/surveys/:id
```

### Submit Response

```
POST /api/surveys/:id/responses
Content-Type: application/json

{
  "questionId": "answer",
  "multiSelectQuestion": ["option1", "option2"]
}
```

### Get Responses (Admin)

```
GET /api/surveys/:id/responses
```

### Export Responses

```
GET /api/surveys/:id/export
```

Returns a downloadable JSON file with all responses.

## Response Storage

Responses are stored in the `responses/` folder as JSON files:

- File naming: `{survey-id}-responses.json`
- Format:

```json
{
  "surveyId": "fillmore-powerlifting",
  "responses": [
    {
      "id": "unique-id",
      "submittedAt": "2026-03-14T12:00:00Z",
      "parentName": "John Doe",
      "athleteName": "Jane Doe",
      ...
    }
  ]
}
```

## Customization

### Styling

Edit `public/styles.css` to customize colors, fonts, and layout. CSS variables at the top of the file make it easy to change the color scheme:

```css
:root {
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --background-color: #f8fafc;
  /* ... */
}
```

### Branding

Update the header in `public/index.html`:

```html
<header>
  <h1>Your Organization Name</h1>
  <p class="subtitle">Your tagline here</p>
</header>
```

## Production Deployment

### Environment Variables

- `PORT`: Server port (default: 3000)

### Running in Production

```bash
NODE_ENV=production npm start
```

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start server/server.js --name survey-platform
pm2 save
```

## License

ISC
