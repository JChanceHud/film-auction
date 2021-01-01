const auction = artifacts.require('FilmAuction')
const assert = require('assert')
const timeMachine = require('ganache-time-traveler')
const BN = require('bn.js')

const defaultGasPrice = '1000000000'

const now = () => Math.floor(+new Date() / 1000)

contract('FilmAuction tests', async accounts => {

  let snapshotId
  beforeEach(async () => {
    const { result } = await timeMachine.takeSnapshot()
    snapshotId = result
  })

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId)
  })

  let MIN_AUCTION_LENGTH, MIN_AUCTION_LEAD_TIME, OWNER_FACTOR, contract
  before('Load variables', async () => {
    contract = await auction.deployed()
    MIN_AUCTION_LENGTH = +(await contract.MIN_AUCTION_LENGTH()).toString()
    MIN_AUCTION_LEAD_TIME = +(await contract.MIN_AUCTION_LEAD_TIME()).toString()
    OWNER_FACTOR = +(await contract.OWNER_FACTOR()).toString()
  })

  describe('create auction', () => {
    it('should fail for non-creator', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      try {
        await contract.createAuctionRound(
          '100',
          '10000',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[1],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Must be creator')
      }
    })

    it('should fail for invalid timing', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart - 1
      try {
        await contract.createAuctionRound(
          '100',
          '10000',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Invalid timing')
      }
    })

    it('should fail for too short auction', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH - 1
      try {
        await contract.createAuctionRound(
          '100',
          '10000',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Invalid auction length')
      }
    })

    it('should fail for invalid start time', async () => {
      const auctionStart = now() - 1
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      try {
        await contract.createAuctionRound(
          '100',
          '10000',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Start time is in past')
      }
    })

    it('should fail for invalid lead time', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME - 1
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      try {
        await contract.createAuctionRound(
          '100',
          '10000',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Too close to start time')
      }
    })

    it('should fail for invalid target amounts', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 60
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      try {
        await contract.createAuctionRound(
          '10000',
          '100',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Invalid target amounts')
      }
      try {
        await contract.createAuctionRound(
          '10000',
          '10000',
          auctionStart.toString(),
          auctionEnd.toString(),
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Invalid target amounts')
      }
    })

    it('should fail for invalid minimum', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 60
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      try {
        await contract.createAuctionRound(
          OWNER_FACTOR.toString(),
          (OWNER_FACTOR + 1).toString(),
          auctionStart,
          auctionEnd,
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Invalid min wei')
      }
    })

    it('should fail to create overlapping auction', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 60
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '1000',
        '100000',
        auctionStart,
        auctionEnd,
        {
          from: accounts[0],
        }
      )
      const overlapAuctionStart = auctionEnd - 10
      const overlapAuctionEnd = overlapAuctionStart + MIN_AUCTION_LENGTH
      try {
        await contract.createAuctionRound(
          '1000',
          '10000',
          overlapAuctionStart,
          overlapAuctionEnd,
          {
            from: accounts[0],
          }
        )
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Auction overlap not allowed')
      }
    })

    it('should create new auction', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 60
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '1000',
        '100000',
        auctionStart,
        auctionEnd,
        {
          from: accounts[0],
        }
      )
    })

  })

  describe('contribute', () => {

    it('should fail if gasprice is too high', async () => {
      const contract = await auction.deployed()
      const maxGasPrice = await contract.maxGasPrice()
      try {
        await contract.contribute(0, {
          from: accounts[1],
          value: '100000',
          gasPrice: (+maxGasPrice + 1).toString(),
        })
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Gas price too high')
      }
    })

    it('should fail for invalid round', async () => {
      const contract = await auction.deployed()
      try {
        await contract.contribute(5, {
          from: accounts[1],
          value: '100000',
          gasPrice: defaultGasPrice,
        })
      } catch (err) {
        assert.equal(err.reason, 'Invalid round index')
      }
    })

    it('should fail to contribute to inactive auction', async () => {
      const contract = await auction.deployed()
      try {
        await contract.contribute(0, {
          from: accounts[1],
          value: '100000'
        })
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Round has ended')
      }
    })

    it('should fail for auction that has not started', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '1000',
        '100000',
        auctionStart.toString(),
        auctionEnd.toString(),
        {
          from: accounts[0],
        },
      )
      const auctionIndex = 1
      try {
        await contract.contribute(auctionIndex, {
          from: accounts[1],
          value: '100',
        })
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Round has not started')
      }
    })

    it('should fail for auction at max contribution', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '1000',
        '100000',
        auctionStart.toString(),
        auctionEnd.toString(),
        {
          from: accounts[0],
        },
      )
      await timeMachine.advanceTimeAndBlock(10 + auctionStart - now())
      const auctionIndex = 1
      await contract.contribute(auctionIndex, {
        from: accounts[1],
        value: '100000000',
      })
      try {
        await contract.contribute(auctionIndex, {
          from: accounts[2],
          value: '100',
        })
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Round max reached')
      }
    })

    it('should fail for individual at max contribution', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '100000',
        '100000000',
        auctionStart.toString(),
        auctionEnd.toString(),
        {
          from: accounts[0],
        },
      )
      const maxContribution = '1000'
      await contract.setMaxContribution(maxContribution, {
        from: accounts[0],
      })
      await timeMachine.advanceTimeAndBlock(10 + auctionStart - now())
      const auctionIndex = 1
      await contract.contribute(auctionIndex, {
        from: accounts[1],
        value: '100000000',
      })
      try {
        await contract.contribute(auctionIndex, {
          from: accounts[1],
          value: '100',
        })
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Max contribution reached')
      }
      const latestRound = await contract.latestRound()
      assert.equal(latestRound.actualWei, maxContribution)
    })

    it('should fail for zero contribution', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '1000',
        '100000',
        auctionStart.toString(),
        auctionEnd.toString(),
        {
          from: accounts[0],
        },
      )
      await timeMachine.advanceTimeAndBlock(10 + auctionStart - now())
      const auctionIndex = 1
      try {
        await contract.contribute(auctionIndex, {
          from: accounts[1],
          value: '0',
        })
        assert(false)
      } catch (err) {
        assert.equal(err.reason, 'Invalid contribution value')
      }
    })

    it('should contribute to auction', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      await contract.createAuctionRound(
        '1000',
        '100000',
        auctionStart.toString(),
        auctionEnd.toString(),
        {
          from: accounts[0],
        },
      )
      const maxContribution = '10000'
      await contract.setMaxContribution(maxContribution, {
        from: accounts[0],
      })
      await timeMachine.advanceTimeAndBlock(10 + auctionStart - now())
      const auctionIndex = 1
      await contract.contribute(auctionIndex, {
        from: accounts[1],
        value: maxContribution,
      })
      const latestRound = await contract.latestRound()
      assert.equal(latestRound.actualWei, maxContribution)
    })

    it('should refund excess', async () => {
      const auctionStart = now() + MIN_AUCTION_LEAD_TIME + 30
      const auctionEnd = auctionStart + MIN_AUCTION_LENGTH
      const auctionLimit = '100000'
      await contract.createAuctionRound(
        '1000',
        auctionLimit,
        auctionStart.toString(),
        auctionEnd.toString(),
        {
          from: accounts[0],
        },
      )
      const maxContribution = '10000'
      await contract.setMaxContribution(maxContribution, {
        from: accounts[0],
      })
      await timeMachine.advanceTimeAndBlock(10 + auctionStart - now())
      const auctionIndex = 1
      {
        const startBalance = await web3.eth.getBalance(contract.address)
        await contract.contribute(auctionIndex, {
          from: accounts[1],
          value: (+maxContribution + 10).toString(),
        })
        const endBalance = await web3.eth.getBalance(contract.address)
        // individual contrib limit
        assert.equal(endBalance.toString(), (+startBalance + +maxContribution).toString())
      }

      await contract.setMaxContribution((10 ** 18).toString(), {
        from: accounts[0],
      })
      const startBalance = await web3.eth.getBalance(contract.address)
      await contract.contribute(auctionIndex, {
        from: accounts[2],
        value: '10000000',
      })
      const endBalance = await web3.eth.getBalance(contract.address)
      // auction contrib limit
      assert.equal(endBalance.toString(), auctionLimit)
    })

  })
})
