const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const Requisition = require('../../models/RequisitionModel');
const { check, validationResult } = require('express-validator');

// @Route   Get api/request
// @desc    Fetch all request by user/creator
// @Access  Private
router.get('/', auth, async (req, res) => {
  let queryParams = {};
  const reqQuery = req.query;

  if (reqQuery) {
    queryParams = reqQuery;
  }
  console.log(req.user.role);
  // queryParameter = {
  //   'inputter.status': false,
  //   date: {
  //     $gte: new Date(2021, 11, 16),
  //     $lt: new Date(2021, 12, 17),
  //   },
  // };
  switch (req.user.role) {
    case 'user':
      queryParams.user = req.user.id;
      break;

    case 'verifier':
      queryParams.departmentalId = req.user.departmentId;
      queryParams['inputter.status'] = true;
      break;

    case 'acc_checker':
      break;

    case 'authorizer':
      queryParams['inputter.status'] = true;
      queryParams['verifier.status'] = true;
      break;

    case 'approver':
      queryParams['inputter.status'] = true;
      queryParams['verifier.status'] = true;
      queryParams['authorizer.status'] = true;
      break;

    default:
      return res.status(401).json({ msg: 'user not authorized' });
      break;
  }
  try {
    console.log(queryParams);
    const requests = await Requisition.find(queryParams);
    res.json(requests);
  } catch (error) {
    console.log(error);
    res.status(500).send('server down');
  }
});

// @Route   get api/request
// @desc    fetch request by requestID by authorizer and all
// @Access  Private
router.get('/:id', auth, async (req, res) => {
  const requestId = req.params.id;
  try {
    const result = await Requisition.findById(requestId).populate('user', [
      'departmentId',
      'name',
      'email',
    ]);
    if (!result) {
      return res
        .status(401)
        .json({ msg: "request with that Id can't be found" });
    }
    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(500).send('server down');
  }
});

// @Route   Post api/request
// @desc    Create or Update request by Creator
// @Access  Private
router.post(
  '/',
  [
    check('itemName', 'Item can not be empty').not().isEmpty(),
    check('unitPrice', 'Unit Price can not be empty').not().isEmpty(),
    check('totalPrice', 'Total Price can not be empty').not().isEmpty(),
    check('ITRelated', 'Item type can not be empty').not().isEmpty(),
    check('vendor', 'Vendor can not be empty').not().isEmpty(),
    check('quantity', 'quantity can not be empty').not().isEmpty(),
    check('departmentalId', 'Department can not be empty').not().isEmpty(),
  ],
  auth,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      itemName,
      unitPrice,
      totalPrice,
      ITRelated,
      discount,
      quantity,
      vendor,
      departmentalId,
      note,
      comment,
      status,
    } = req.body;
    const { requestId } = req.query;

    try {
      // for updating Requisition by User
      // check if the requisition is valid
      if (requestId) {
        const requestResult = await Requisition.findById(requestId);
        if (!requestResult) {
          return res.status(401).json({ msg: "Requisition can't be found" });
        }

        // set new Update object
        let update = {};
        update.itemName = itemName;
        update.unitPrice = unitPrice;
        update.discount = discount;
        update.totalPrice = totalPrice;
        update.ITRelated = ITRelated;
        update.quantity = quantity;
        update.vendor = vendor;
        update.note = note;
        if (comment) {
          update.comment = comment;
        }
        // for inputter
        if (status) {
          update.inputter = {};
          update.inputter.status = status;
        }
        const updatedRequest = await Requisition.findByIdAndUpdate(
          requestId,
          update,
          {
            new: true,
          }
        );
        return res.json(updatedRequest);
      }
      // For new Requisition
      let request = new Requisition({
        user: req.user.id,
        itemName,
        unitPrice,
        discount,
        totalPrice,
        ITRelated,
        quantity,
        vendor,
        departmentalId,
        note,
      });
      const result = await request.save();
      return res.json(result);
    } catch (error) {
      console.log(error);
      res.status(500).send('server down');
    }
  }
);

// @Route   put api/request BY others roles aside user
// @desc    Update request by requestID
// @Access  Private
router.put('/:id', auth, async (req, res) => {
  const requestId = req.params.id;
  const {
    verifyStatus,
    acc_checkerStatus,
    authorizerStatus,
    approverStatus,
  } = req.body;
  try {
    // check if the user is authorize here
    const user = req.user;
    if (user.role === 'user')
      return res
        .status(401)
        .json({ msg: "you aren't authorized to view this page" });
    // check if the requisition exit
    const requestResult = await Requisition.findById(requestId);
    if (!requestResult) {
      return res.status(401).json({ msg: "Requisition can't be found" });
    }
    // set the update field
    const update = {};
    switch (user.role) {
      case 'verifier':
        update.verify = {};
        update.verify.status = verifyStatus;
        update.verify.verifier = user.id;
        break;

      case 'acc_checker':
        update.acc_check = {};
        update.acc_check.status = acc_checkerStatus;
        update.acc_check.acc_checker = user.id;
        break;

      case 'authorizer':
        update.authorize = {};
        update.authorize.status = authorizerStatus;
        update.authorize.authorizer = user.id;
        break;

      case 'approver':
        update.approve = {};
        update.approve.status = approverStatus;
        update.approve.approver = user.id;
        break;

      default:
        return res.status(401).json({ msg: 'user not authorized' });
        break;
    }
    // update requisition and save
    const updatedRequest = await Requisition.findByIdAndUpdate(
      requestId,
      update,
      {
        new: true,
      }
    );
    return res.json(updatedRequest);
  } catch (error) {
    console.log(error);
    res.status(500).send('server down');
  }
});
module.exports = router;