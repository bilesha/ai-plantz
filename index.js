import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Welcome to a terrible Docker Tutorial');
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});