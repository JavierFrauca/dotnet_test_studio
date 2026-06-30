import { useStore } from '../store'

/** Confirmación para hacer `git checkout` del working tree al elegir rama sin worktree aislado. */
export function BranchCheckoutModal() {
  const pending = useStore((s) => s.pendingBranch)
  const current = useStore((s) => s.selectedBranch)
  const busy = useStore((s) => s.checkoutBusy)
  const error = useStore((s) => s.checkoutError)
  const confirm = useStore((s) => s.confirmBranchCheckout)
  const cancel = useStore((s) => s.cancelBranchCheckout)

  if (!pending) return null

  return (
    <div className="overlay overlay-top">
      <div className="modal modal-confirm">
        <div className="confirm-head">
          <span className="confirm-icon"><i className="ti ti-git-branch" /></span>
          <div>
            <div className="confirm-title">Switch branch</div>
            <div className="confirm-sub">This checks out your working copy.</div>
          </div>
        </div>

        <div className="confirm-branches">
          <span className="confirm-chip from">{current ?? '—'}</span>
          <i className="ti ti-arrow-right" />
          <span className="confirm-chip to">{pending}</span>
        </div>

        <div className="confirm-warn">
          <i className="ti ti-alert-triangle" />
          <span>
            Your working tree will switch to <b>{pending}</b>. Uncommitted changes that conflict will block the switch.
          </span>
        </div>

        {error && <pre className="modal-error-body mono">{error}</pre>}

        <div className="confirm-actions">
          <button className="btn" disabled={busy} onClick={() => cancel()}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void confirm()}>
            {busy ? (
              <>
                <span className="mini-spinner" /> Switching…
              </>
            ) : (
              <>
                <i className="ti ti-git-branch" /> Checkout {pending}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
