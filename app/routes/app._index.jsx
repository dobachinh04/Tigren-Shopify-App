import { json } from "@remix-run/node";
import "../styles/pagination.css";
import "../styles/searchbar.css";
import { useLoaderData, Link, useNavigate, useSearchParams } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Thumbnail,
  TextField,
  Pagination,
  Icon,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { getQRCodes } from "../models/QRCode.server";
import { AlertDiamondIcon, ImageIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";

// Loader lấy dữ liệu từ server
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const search = url.searchParams.get("search") || "";
  const pageSize = 5; // Số lượng item mỗi trang

  const qrCodes = await getQRCodes(session.shop, admin.graphql);

  // Lọc dữ liệu theo search term
  const filteredQRCodes = qrCodes.filter((qr) =>
    qr.title.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedQRCodes = filteredQRCodes.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredQRCodes.length / pageSize);

  return json({
    qrCodes: paginatedQRCodes,
    currentPage: page,
    totalPages,
    search,
  });
}

// Truncate text utility
function truncate(str, { length = 25 } = {}) {
  if (!str) return "";
  return str.length <= length ? str : str.slice(0, length) + "…";
}

// Row hiển thị từng QR code trong IndexTable
const QRTableRow = ({ qrCode }) => (
  <IndexTable.Row id={qrCode.id} position={qrCode.id}>
    <IndexTable.Cell>
      <Thumbnail
        source={qrCode.productImage || ImageIcon}
        alt={qrCode.productTitle || "No image available"}
        size="small"
      />
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Link to={`qrcodes/${qrCode.id}`}>{truncate(qrCode.title)}</Link>
    </IndexTable.Cell>
    <IndexTable.Cell>
      {qrCode.productDeleted ? (
        <InlineStack align="start" gap="200">
          <Icon source={AlertDiamondIcon} tone="critical" />
          <Text tone="critical" as="span">
            Product has been deleted
          </Text>
        </InlineStack>
      ) : (
        truncate(qrCode.productTitle)
      )}
    </IndexTable.Cell>
    <IndexTable.Cell>{new Date(qrCode.createdAt).toDateString()}</IndexTable.Cell>
    <IndexTable.Cell>{qrCode.scans}</IndexTable.Cell>
  </IndexTable.Row>
);

// Component chính hiển thị IndexTable, search và pagination
export default function Index() {
  const { qrCodes, currentPage, totalPages, search } = useLoaderData();
  const [searchValue, setSearchValue] = useState(search);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // const handleSearchChange = (value) => {
  //   setSearchValue(value);
  //   navigate(`?search=${value}&page=1`);
  // };

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const handlePageChange = (newPage) => {
    navigate(`?search=${params.get("search") || ""}&page=${newPage}`);
  };

  const debouncedSearch = useCallback(
    debounce((value) => {
      navigate(`?search=${value}&page=1`);
    }, 1000),
    [navigate]
  );

  const handleSearchChange = (value) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  return (
    <Page
      title="QR codes"
      primaryAction={{
        content: "Create QR code",
        onAction: () => navigate("/app/qrcodes/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
          <div className="search-bar-container">
              <TextField
                label="Search QR codes"
                value={searchValue}
                onChange={handleSearchChange}
                autoComplete="off"
                placeholder="Search by title"
                className="search-bar"
              />
            </div>

            {qrCodes.length === 0 ? (
              <EmptyState
                heading="No QR codes found"
                action={{
                  content: "Create QR code",
                  onAction: () => navigate("/app/qrcodes/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Try adjusting your search or create a new QR code.</p>
              </EmptyState>
            ) : (
              <>
                <IndexTable
                  resourceName={{ singular: "QR code", plural: "QR codes" }}
                  itemCount={qrCodes.length}
                  headings={[
                    { title: "Thumbnail", hidden: true },
                    { title: "Title" },
                    { title: "Product" },
                    { title: "Date created" },
                    { title: "Scans" },
                  ]}
                  selectable={false}
                >
                  {qrCodes.map((qrCode) => (
                    <QRTableRow key={qrCode.id} qrCode={qrCode} />
                  ))}
                </IndexTable>

                <div className="pagination-container">
                  <button
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </button>

                  {/* Hiển thị số trang hiện tại / tổng số trang */}
                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
