const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  restockProduct,
  deleteProduct
} = require('../controllers/productController');

router.use(verifyToken); // semua endpoint barang wajib login

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/restock', restockProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
