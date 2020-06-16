import { Container } from 'reactstrap'
import { connect } from 'react-redux'
import useSWR from 'swr'
import { getPaginationVariables } from '../lib/pagination'
import UsersTable from '../components/UsersTable'
import { dbGraphFetcher } from '../lib/fetchers'

const Followers = ({ database, twitterClient, query }) => {
  const pageSize = 100
  const table = 'followers'
  const { skip, first, page } = getPaginationVariables(pageSize, query)
  const { data, error } = useSWR(
    ['/api/query-graph', database.string, twitterClient, table, first, skip],
    dbGraphFetcher
  )
	return (
		<>
			<Container>
        <h1 className="mt-5">Followers</h1>
        <div className="mt-3 mb-5">
        { error ? (<h3>Failed to load followers</h3>) : null }
        { !error & !data ? (<h3>Loading...</h3>) : null }
        { data && data.users ? (
          <UsersTable link={"/followers"}
            twitterClient={twitterClient}
            users={data.users} usersCount={data.count}
            page={page} pageSize={pageSize} />
        ) : null }
        </div>
      </Container>
		</>
	)
}

export async function getServerSideProps({ query }) {
  return {
    props: { query },
  }
}

const mapStateToProps = (state) => ({
  database: state.database,
  twitterClient: state.twitterClient
})

const mapDispatchToProps = {}

export default connect(mapStateToProps, mapDispatchToProps)(Followers)
